#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <signal.h>

#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include <libwebsockets.h>
#include <cjson/cJSON.h>

// 8000 + 0184 - why not?
#define PORT 8184

// Number of entires in history, one entry per minute
#define HIST_ENTRIES (6*60)
#define JSONBUF_SIZE 4096

typedef enum {
  none = 0,
  airmar_wind = 1,
  airmar_history = 2,
  tempest_wind = 4,
  tempest_history = 8,
} sensor_subscriptions;

/* Tempest data structures */
#define TEMPEST_ADDR "255.255.255.255"
#define TEMPEST_PORT 50222

#define TEMPEST_HIST_ENTRIES HIST_ENTRIES

struct {
  float avg;
  float gust;
  float direction;
  float temp;
  float baro;
  float rapid_speed;
  float rapid_speed_avg;
  float rapid_dir;
  float rapid_dir_avg;
} tempest_last_samples;

#define TEMPEST_RECENT_BUF 120
struct {
  unsigned int sec;
  double speed;
  double dir;
} tempest_recent_wind[TEMPEST_RECENT_BUF];
char tempest_wind_msgbuf[256];
char *tempest_wind_msg;
char tempest_wind_len;
int tempest_recent_idx = 0;

#define TEMPEST_HIST_ENTRY_JSON "{\"sec\": %u, \"speed\": %4.1f, \"gust\": %4.1f, \"dir\": %5.1f},"
// Minutes between history updates
#define TEMPEST_HIST_FREQUENCY 1

// json payload + websocket preamble - should be small, but only one is allocated
#define MSGBUF (64*1024)

struct {
  unsigned int sec;
  float speed;
  float gust;
  float dir;
} tempest_hist[HIST_ENTRIES]; // six hours of wind history
char tempest_hist_msgbuf[MSGBUF];
char *tempest_hist_msg; // ptr to msgbuf + LWS_PRE
int tempest_hist_len;

int tempest_hist_size;
int tempest_hist_last_minute;
int tempest_hist_entry_json_len;

/* websocket client state */
struct per_session_data__wind {
  struct per_session_data__wind *pss_list; /* linked list to next client */
  struct lws *wsi;
  sensor_subscriptions subscriptions;
  sensor_subscriptions needs;
};

/* one of these is created for each vhost our protocol is used with */
struct per_vhost_data__wind {
  struct lws_context *context;
  struct lws_vhost *vhost;
  const struct lws_protocols *protocol;

  struct per_session_data__wind *pss_list; /* linked-list of live pss*/

  int tempest_sock; /* Serial port file descriptor */
};

static void init_history() {
  // Measure how big a history json message is
  struct timeval tv;
  gettimeofday(&tv, NULL);

  lwsl_user("Initializing history sec %u", tv.tv_sec);
  int i;
  unsigned m = tv.tv_sec / 60;
  for (i = 0; i < HIST_ENTRIES; i++) {
    int idx = (tv.tv_sec - i) % HIST_ENTRIES;
    tempest_hist[idx].sec = (m - i) * 60; // convert from minute to seconds
    tempest_hist[idx].speed = 0.0;
    tempest_hist[idx].gust = 0.0;
    tempest_hist[idx].dir = 0.0;
  }
}

static sensor_subscriptions
process_tempest(struct lws *wsi, void *user)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  sensor_subscriptions new_data = none;

  cJSON *json;
  char jsonbuf[JSONBUF_SIZE];
  struct sockaddr_in addr;
  int addrlen = sizeof(addr);
  int nbytes = recvfrom(vhd->tempest_sock, jsonbuf, JSONBUF_SIZE - 1, 0, (struct sockaddr *) &addr, &addrlen);
  if (nbytes < 0) {
    perror("recvfrom");
    return 1;
  }
  jsonbuf[nbytes] = '\0';
  // lwsl_notice("Received(%d) %s\n", nbytes, jsonbuf);
  json = cJSON_ParseWithLength(jsonbuf, nbytes);

  // lwsl_hexdump_level(LLL_NOTICE, buf, (unsigned int)n);
  // lwsl_user("Read (%d) %s", n, buf);
  
  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = (unsigned int) tv.tv_sec;
  unsigned int this_minute = this_second / 60;

  const cJSON *sn = cJSON_GetObjectItemCaseSensitive(json, "serial_number");
  const cJSON *msgtype = cJSON_GetObjectItemCaseSensitive(json, "type");
  const cJSON *obs = cJSON_GetObjectItemCaseSensitive(json, "obs");
  const cJSON *ob = cJSON_GetObjectItemCaseSensitive(json, "ob");

  // lwsl_notice("msgtype %s\n", msgtype->valuestring);

  double speed = -1.0;
  double dir = -1.0;

  // {"serial_number":"ST-00057643","type":"rapid_wind","hub_sn":"HB-00073154","ob":[1668645409,0.18,4]}
  if (!strcmp(msgtype->valuestring, "rapid_wind")) {
    const cJSON *child = ob->child;
    speed = child->next->valuedouble; // meters/second
    dir = child->next->next->valuedouble;
    lwsl_notice("rapid_wind: ob ts %d speed %.2f direction %.0f\n", child->valueint, speed, dir);
    
    tempest_recent_idx = (tempest_recent_idx + 1) % TEMPEST_RECENT_BUF;
    tempest_recent_wind[tempest_recent_idx].sec = this_second;
    tempest_recent_wind[tempest_recent_idx].speed = speed;
    tempest_recent_wind[tempest_recent_idx].dir = dir;

    /* Do our own averging of speed and direction over the last two minutes.
     *
     * Determine average wind angle - what happens when wind is oscillating from dead ahead?
     * If some samples are slightly positive and others are 'negative' (close to 360) then
     * the average is close to 180! This is not zero, as it should be. So keep track of a total
     * of the angles + 180 degrees - more samples are 'north' use the biased total, otherwise
     * use the unbiased total.
     */
    float speed_avg = 0.0, gust = 0.0, dir_avg = 0.0, dir_bias = 0.0;
    int south_count = 0;
    int samples = 0;
    for (int i = 0; i < TEMPEST_RECENT_BUF; i++) {
      if (tempest_recent_wind[i].sec < tv.tv_sec - 120) continue;

      samples++;
      float tspeed = tempest_recent_wind[i].speed;
      float tdir = tempest_recent_wind[i].dir;
      speed_avg += tspeed;
      if (tspeed > gust) gust = tspeed;

      dir_avg += tdir;
      dir_bias += (tdir + ((tdir < 180.0) ? 180.0 : -180.0));
      if ((tdir > 90.0) && (tdir <= 270.0)) south_count++;
    }
    dir_avg /= samples;

    if (south_count > (samples/2))
      dir_avg /= samples; /* More than half are south-ish */
    else {
      //lwsl_notice("south %d awa %.1f awa_bias %.2f / %d = avg %.0f", south_count, awa, awa_bias, RECENT_BUF, awa_bias/RECENT_BUF);
      dir_avg = (dir_bias / samples) - 180.0; /* More than half are north-ish */
      if (dir_avg < 0) dir_avg +- 360.0;
    }

    // Overwrite the entry for this minute with the latest reading
    int tempest_hist_idx = this_minute % HIST_ENTRIES;
    tempest_hist[tempest_hist_idx].sec = this_second;
    tempest_hist[tempest_hist_idx].speed = speed_avg;
    tempest_hist[tempest_hist_idx].gust = gust;
    tempest_hist[tempest_hist_idx].dir = dir_avg;

    tempest_last_samples.rapid_speed = speed;
    tempest_last_samples.rapid_speed_avg = speed_avg;
    tempest_last_samples.rapid_dir = dir;
    tempest_last_samples.rapid_dir_avg = dir_avg;
    
    sprintf(tempest_wind_msg, "{\"speed\": %4.1f, \"speed_avg\": %4.1f, \"gust\": %4.1f, \"dir\": %3.0f, \"dir_avg\": %3.0f}", speed, speed_avg, gust, dir, dir_avg);
    tempest_wind_len = strlen(tempest_wind_msg);
    
    new_data |= tempest_wind;
  }

  // {"serial_number":"ST-00057643","type":"obs_st","hub_sn":"HB-00073154","obs":[[1668645436,0.18,1.94,2.94,19,3,1025.67,15.61,44.46,1698,0.02,14,0.000000,0,0,0,2.713,1]],"firmware_revision":165}
  if (!strcmp(msgtype->valuestring, "obs_st")) {
    const cJSON *child = obs->child;
    const cJSON *a = child->child;

    const int ts = a->valueint;
    a = a->next;
    const double wind_lull = a->valuedouble;
    a = a->next;
    const double wind_avg = a->valuedouble;
    a = a->next;
    const double wind_gust = a->valuedouble;
    a = a->next;
    const double wind_direction = a->valuedouble;
    a = a->next;
    const double wind_sample_interval = a->valuedouble;
    a = a->next;
    const double wind_station_pressure = a->valuedouble;
    a = a->next;
    const double wind_air_temperature = a->valuedouble;
    a = a->next;
    const double wind_relative_humidity = a->valuedouble;
    a = a->next;
    const double wind_illuminance = a->valuedouble;
    a = a->next;
    const double wind_uv = a->valuedouble;
    a = a->next;
    const double wind_solar_radiation = a->valuedouble;
    a = a->next;
    const double wind_rain_last_minute = a->valuedouble;
    a = a->next;
    const double wind_precipitation_type = a->valuedouble;
    a = a->next;
    const double wind_lightning_strike_distance = a->valuedouble;
    a = a->next;
    const double wind_lightning_strike_count = a->valuedouble;
    a = a->next;
    const double wind_battery = a->valuedouble;
    a = a->next;
    const int wind_report_interval = a->valueint;

    lwsl_notice("ob_st ts %d avg %.1f gust %.1f dir %.0f battery %.1f interval %d\n", ts, wind_avg, wind_gust, wind_direction, wind_battery, wind_report_interval);
    tempest_last_samples.avg = wind_avg;
    tempest_last_samples.gust = wind_gust;
    tempest_last_samples.direction = wind_direction;
    tempest_last_samples.temp = wind_air_temperature;
    tempest_last_samples.baro = wind_station_pressure;

    int this_minute = tv.tv_sec / 60;
    int index = (this_minute % TEMPEST_HIST_ENTRIES);
    if (this_minute != tempest_hist_last_minute) {
      if (!(this_minute % TEMPEST_HIST_FREQUENCY)) {
	char entry[128];
	// Create history JSON buffer
	strcpy(tempest_hist_msg, "{ \"event\": \"tempest_history\"");
	sprintf(entry, ", \"baro\": %.1f", tempest_last_samples.baro);
	strcat(tempest_hist_msg, entry);
	sprintf(entry, ", \"temp\": %.1f", tempest_last_samples.temp);
	strcat(tempest_hist_msg, entry);
	sprintf(entry, ", \"avg\": %.1f", tempest_last_samples.avg);
	strcat(tempest_hist_msg, entry);
	sprintf(entry, ", \"gust\": %.1f", tempest_last_samples.gust);
	strcat(tempest_hist_msg, entry);
	sprintf(entry, ", \"dir\": %.1f", tempest_last_samples.direction);
	strcat(tempest_hist_msg, entry);
	
	strcat(tempest_hist_msg, ", \"history\": [");
	for (int i = 0; i < TEMPEST_HIST_ENTRIES; i++) { // BARF - this is n^2 in HIST_ENTRIES
	  int h = (this_minute + i) % TEMPEST_HIST_ENTRIES;
	  sprintf(entry, TEMPEST_HIST_ENTRY_JSON, tempest_hist[h].sec, tempest_hist[h].speed, tempest_hist[h].gust, tempest_hist[h].dir);
	  strcat(tempest_hist_msg, entry);
	}
	
	tempest_hist_msg[strlen(tempest_hist_msg) - 1] = 0; // Chomp off the trailing comma
	strcat(tempest_hist_msg, "]}");
	tempest_hist_len = strlen(tempest_hist_msg); // do we need to include the LWS_PRE?
	       
	//lwsl_user("HISTORY %d entries length %d", HIST_ENTRIES, strlen(&hist_buf[LWS_PRE]));
	//lwsl_user("%s", &hist_buf[LWS_PRE]);
	new_data |= tempest_history;
      }
      //lwsl_user("new minute seconds %u index %d ", tv.tv_sec, index);
    }
  }

  cJSON_Delete(json);
  return new_data;
}

static sensor_subscriptions
process_airmar(struct lws *wsi, void *user, void *in, size_t len)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  sensor_subscriptions new_data = none;

  return new_data;
}

static int
callback_wind(struct lws *wsi, enum lws_callback_reasons reason,
		 void *user, void *in, size_t len)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));
  int n, m;
  lws_sock_file_fd_type u;
  uint8_t buf[128];
  cJSON *json;

  switch (reason) {
  case LWS_CALLBACK_PROTOCOL_INIT:
    lwsl_user("LWS_CALLBACK_PROTOCOL_INIT: wsi %p\n", wsi);
    vhd = lws_protocol_vh_priv_zalloc(lws_get_vhost(wsi),
				      lws_get_protocol(wsi),
				      sizeof(struct per_vhost_data__wind));
    vhd->context = lws_get_context(wsi);
    vhd->protocol = lws_get_protocol(wsi);
    vhd->vhost = lws_get_vhost(wsi);

    // Should open the file in "cooked" mode to make sure we don't get per-character upcalls
    if ((vhd->tempest_sock = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
      perror("socket");
      return(1);
    }

    u_int yes = 1;
    if (setsockopt(vhd->tempest_sock, SOL_SOCKET, SO_BROADCAST, &yes, sizeof(yes)) < 0) {
      perror("setsockopt");
      return 1;
    }

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(TEMPEST_PORT);

    if (bind(vhd->tempest_sock, (struct sockaddr *) &addr, sizeof(struct sockaddr)) < 0) {
      lwsl_err("Unable to bind\n");
      return 1;
    }

    u.filefd = (lws_filefd_type)(long long)vhd->tempest_sock;
    if (!lws_adopt_descriptor_vhost(lws_get_vhost(wsi),
				    LWS_ADOPT_RAW_FILE_DESC, u, "wind", NULL)) {
      lwsl_err("Failed to adopt serial port file descriptor\n");
      close(vhd->tempest_sock);
      vhd->tempest_sock = -1;

      return 1;
    }
    tempest_wind_msg = &tempest_wind_msgbuf[LWS_PRE];
    tempest_hist_msg = &tempest_hist_msgbuf[LWS_PRE];
    lwsl_user("LWS_CALLBACK_PROTOCOL_INIT: socket fd %d\n", vhd->tempest_sock);

    break;

  case LWS_CALLBACK_PROTOCOL_DESTROY:
    if (vhd->tempest_sock != -1)
      close(vhd->tempest_sock);
    break;

  case LWS_CALLBACK_ESTABLISHED:
    /* add ourselves to the list of websocket clients */
    lwsl_user("LWS_CALLBACK_ESTABLISHED: wsi %p\n", wsi);
    lws_ll_fwd_insert(pss, pss_list, vhd->pss_list);
    pss->wsi = wsi;
    break;

  case LWS_CALLBACK_CLOSED:
    /* remove ourselves from the client list */
    lwsl_user("LWS_CALLBACK_CLOSED: wsi %p\n", wsi);
    lws_ll_fwd_remove(struct per_session_data__wind, pss_list, pss, vhd->pss_list);
    break;

  case LWS_CALLBACK_SERVER_WRITEABLE:
    /* notice we allowed for LWS_PRE in the payload already */

    // Send history if it's been called for
    if (pss->needs & tempest_history) {
      //lwsl_user("Sending history");
      m = lws_write(wsi, tempest_hist_msg, tempest_hist_len, LWS_WRITE_TEXT);
      if (m < tempest_hist_len) {
	lwsl_err("ERROR %d writing tempest history to ws socket\n", m);
	return -1;
      }
      lws_callback_on_writable(pss->wsi); // Still need to send last wind reading
      pss->needs &= tempest_history;
      break;
    }
    
    if (pss->needs & tempest_wind) {
      //lwsl_user("Sending update %s\n", &vhd->msg[LWS_PRE]);
      m = lws_write(wsi, tempest_wind_msg, tempest_wind_len, LWS_WRITE_TEXT);
      if (m < tempest_wind_len) {
	lwsl_err("ERROR %d writing tempest wind to ws socket\n", m);
	return -1;
      }
      pss->needs &= tempest_wind;
      break;
    }
    break;

  case LWS_CALLBACK_RECEIVE:
    //((char *)in)[len] = 0; // Not zero terminated!
    lwsl_notice("LWS_CALLBACK_RECEIVE cJSON (len %d) %s\n", len, in);
    json = cJSON_ParseWithLength(in, len);
    if (json == NULL) {
      lwsl_err("LWS_CALLBACK_RECEIVE cJSON couldn't parse (len %d) %s\n", len, in);
      break;
    }

    const cJSON *tempest_wind = cJSON_GetObjectItemCaseSensitive(json, "subscribe_tempest_wind");
    const cJSON *tempest_history = cJSON_GetObjectItemCaseSensitive(json, "subscribe_tempest_history");

    if (tempest_wind != NULL) {
      if (cJSON_IsBool(tempest_wind)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_tempest_wind %d\n", tempest_wind->valueint);
	if (tempest_wind->valueint == 1) {
	  pss->subscriptions |= tempest_wind;
	} else {
	  pss->subscriptions &= ~tempest_wind;
	}
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_wind %d\n", pss->subscribe_tempest_wind);
      }
    }

    if (history != NULL) {
      if (cJSON_IsBool(tempest_history)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_tempest_history %d\n", tempest_history->valueint);
	if (tempest_history->valueint == 1) {
	  pss->subscriptions |= tempest_history;
	} else {
	  pss->subscriptions &= ~tempest_history;
	}
      }
    }

    cJSON_Delete(json);
    break;

  case LWS_CALLBACK_RAW_ADOPT_FILE:
    lwsl_notice("LWS_CALLBACK_RAW_ADOPT_FILE\n");
    break;

  case LWS_CALLBACK_RAW_RX_FILE:
    /* Read and parse a text line from the weather station, tell clients there's data to send */
    lwsl_debug("LWS_CALLBACK_RAW_RX_FILE len %d\n", len);

    /* For now, the Airmar is on a serial line so the callback has an actual data length
     * while the Tempest is an unread socket with length zero.
     * There has to be a better way to figure out which fd has input available.
     */

    sensor_subscriptions new_pubs;
    if (len == 0) {
      new_pubs = process_tempest(wsi, user);
    } else {
      new_pubs = process_airmar(wsi, user, in, len);
    }

    /* Enable writing on clients subscribed to this data */
    lws_start_foreach_llp(struct per_session_data__wind **,
			  ppss, vhd->pss_list) {
      (*ppss)->needs |= ((*ppss)->subscriptions & new_pubs);
      if ((*ppss)->needs != none) lws_callback_on_writable((*ppss)->wsi);
    } lws_end_foreach_llp(ppss, pss_list);
    break;
		
  case LWS_CALLBACK_RAW_CLOSE_FILE:
    lwsl_notice("LWS_CALLBACK_RAW_CLOSE_FILE\n");
    break;

  case LWS_CALLBACK_RAW_WRITEABLE_FILE:
    lwsl_notice("LWS_CALLBACK_RAW_WRITEABLE_FILE\n");
    /*
     * Shouldn't happen since file is open read-only
     */
    break;

  default:
    break;
  }

  return 0;
}

static struct lws_protocols protocols[] = {
  { "wind", callback_wind, sizeof(struct per_session_data__wind), 0, 0, NULL, 0 },
  LWS_PROTOCOL_LIST_TERM
};

static int interrupted;

void sigint_handler(int sig)
{
  interrupted = 1;
}

int main(int argc, const char **argv)
{
  struct lws_context_creation_info info;
  struct lws_context *context;
  const char *p;
  int n = 0, logs = LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE
    /* for LLL_ verbosity above NOTICE to be built into lws,
     * lws must have been configured and built with
     * -DCMAKE_BUILD_TYPE=DEBUG instead of =RELEASE */
    /* | LLL_INFO */ /* | LLL_PARSER */ /* | LLL_HEADER */
    /* | LLL_EXT */ /* | LLL_CLIENT */ /* | LLL_LATENCY */
    /* | LLL_DEBUG */;

  signal(SIGINT, sigint_handler);

  if ((p = lws_cmdline_option(argc, argv, "-d")))
    logs = atoi(p);

  lws_set_log_level(logs, NULL);
  lwsl_user("LWS Serve up wind from a WeatherFlow Tempest wind instrument\n");
  if (argc != 1) {
    lwsl_user("Usage: %s", argv[0]);
    return 1;
  }

  signal(SIGINT, sigint_handler);

  memset(&info, 0, sizeof info);
  info.port = PORT;
  info.protocols = protocols;

  context = lws_create_context(&info);
  if (!context) {
    lwsl_err("lws init failed\n");
    return 1;
  }

  init_history(); // this should be in the vhd

  while (n >= 0 && !interrupted)
    n = lws_service(context, 0);

  lws_context_destroy(context);

  return 0;
}
