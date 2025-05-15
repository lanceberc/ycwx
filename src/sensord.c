#include <signal.h>
#include <termios.h> // Contains POSIX terminal control definitions
#include <fcntl.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <sys/wait.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>

#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include <libwebsockets.h>
#include <cjson/cJSON.h>

#define HAS_TEMPEST 1
#define HAS_AIRMAR 1

// Our sensor is not pointed north - add SENSOR_OFFSET to each reading
#define SENSOR_OFFSET -25.0

// The hardware for power-cycling the Airmar using the Pi's IO ports has been removed
#define CHECK_AIRMAR 0

// 8000 + 0183 - why not?
#define PORT 8183

// Number of entires in history, one entry per minute
#define HIST_ENTRIES (6*60)
#define JSONBUF_SIZE 4096

#define SUBSCRIBE_NONE 0
#define SUBSCRIBE_AIRMAR_WIND 1
#define SUBSCRIBE_AIRMAR_HIST 2
#define SUBSCRIBE_TEMPEST_WIND 4
#define SUBSCRIBE_TEMPEST_HIST 8

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

/* Airmar data structures */
unsigned long airmar_last_timestamp = 0;
unsigned long airmar_first_timestamp = 0;

static char *airmartty[] = {
  "/dev/ttyUSB0",
  "/dev/ttyUSB1"
};
  
char *airmarfn;

#define AIRMAR_TRUE 1
#define AIRMAR_APPARENT 2

#define SOURCE AIRMAR_APPARENT

/* should the buffer be in the vhd? */
#define AIRMAR_RECENT 120

// Define gusts as average over the last N samples - 4 should be 2 seconds
#define AIRMAR_WINDSPEED_SECONDS 120
#define AIRMAR_GUST_SAMPLES 6
#define AIRMAR_GUST_WINDOW 30
/*#define AIRMAR_GUST_DEBUG 1*/

struct {
  unsigned int sec;
  double speed;
  double dir;
} airmar_recent[AIRMAR_RECENT];

char airmar_wind_msgbuf[256];
char *airmar_wind_msg;
char airmar_wind_len;
int airmar_recent_idx = 0;
int airmar_hist_index = 0;
unsigned long airmar_last_save = 0; // Minute last saved
int airmar_rebooting = 0;
int airmar_reboot_timeout = 300;
#define AIRMAR_POWER_PATH "/home/stfyc/bin/airmar_power.py"
#define AIRMAR_REBOOT_PATH "/home/stfyc/bin/airmar_restart.sh"
#define AIRMAR_SAVE_FREQ 5
#define AIRMAR_SAVE_FILE "/home/stfyc/www/html/data/airmar_history.txt"
float airmar_high_gust = 0.0;
unsigned long airmar_last_good_sample = 0;
int airmar_bad_read = 0;
unsigned long sensord_start = 0;

/*#define AIRMAR_HIST_ENTRY_JSON "{\"ts\": %u, \"aws\": %4.1f, \"gust\": %4.1f, \"awa\": %5.1f},"*/
#define AIRMAR_HIST_ENTRY_JSON "{\"sec\": %u, \"speed\": %4.1f, \"gust\": %4.1f, \"dir\": %5.1f},"
#define AIRMAR_HIST_FREQUENCY 1
struct {
  unsigned long ts;
  float speed;
  float gust;
  float dir;
} airmar_hist[HIST_ENTRIES]; // six hours of wind history
unsigned int airmar_hist_last_minute;
char airmar_hist_msgbuf[MSGBUF];
char *airmar_hist_msg;
int airmar_hist_len;

struct {
  float tws;
  float twa;
  float aws;
  float awa;
  float baro;
  float temp;
} airmar_last_samples;


/* websocket client state */
struct per_session_data__wind {
  struct per_session_data__wind *pss_list; /* linked list to next client */
  struct lws *wsi;
  unsigned int subscriptions;
  unsigned int needs;
};

/* one of these is created for each vhost our protocol is used with */
struct per_vhost_data__wind {
  struct lws_context *context;
  struct lws_vhost *vhost;
  const struct lws_protocols *protocol;

  struct per_session_data__wind *pss_list; /* linked-list of live pss*/

  int airmar_fd; /* Serial port file descriptor for Airmar NMEA-0183 device (4800 baud) */
  int tempest_sock; /* Socket for Tempest broadcast UDP packets */
};

unsigned int tempest_init(struct lws *wsi, void *user)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  int fd;
  lws_sock_file_fd_type u;

  // Should open the file in "cooked" mode to make sure we don't get per-character upcalls
  if ((fd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
    perror("socket");
    return(1);
  }
  vhd->tempest_sock = fd;
  
  u_int yes = 1;
  if (setsockopt(fd, SOL_SOCKET, SO_BROADCAST, &yes, sizeof(yes)) < 0) {
    perror("setsockopt");
    return 1;
  }

  struct sockaddr_in addr;
  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  addr.sin_port = htons(TEMPEST_PORT);

  if (bind(fd, (struct sockaddr *) &addr, sizeof(struct sockaddr)) < 0) {
    lwsl_err("Unable to bind\n");
    return 1;
  }

  u.filefd = (lws_filefd_type)(long long)fd;
  if (!lws_adopt_descriptor_vhost(lws_get_vhost(wsi),
				  LWS_ADOPT_RAW_FILE_DESC, u, "wind", NULL)) {
    lwsl_err("Failed to adopt serial port file descriptor\n");
    close(fd);
    vhd->tempest_sock = -1;

    return 1;
  }
  tempest_wind_msg = &tempest_wind_msgbuf[LWS_PRE];
  tempest_hist_msg = &tempest_hist_msgbuf[LWS_PRE];
  lwsl_notice("tempest_init: tempest socket fd %d\n", fd);

  struct timeval tv;
  gettimeofday(&tv, NULL);
  lwsl_notice("Initializing history sec %u", tv.tv_sec);
  unsigned int this_minute = tv.tv_sec / 60;
  for (int i = 0; i < HIST_ENTRIES; i++) {
    int idx = (this_minute - i) % HIST_ENTRIES;
    tempest_hist[idx].sec = (this_minute - i) * 60;
    tempest_hist[idx].speed = 0.0;
    tempest_hist[idx].gust = 0.0;
    tempest_hist[idx].dir = 0.0;
  }

  return 0;
}

static unsigned int
tempest_process(struct lws *wsi, void *user)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  unsigned int new_publication = SUBSCRIBE_NONE;

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
  lwsl_debug("tempest_process received(%d) %s\n", nbytes, jsonbuf);
  json = cJSON_ParseWithLength(jsonbuf, nbytes);

  lwsl_hexdump_level(LLL_DEBUG, jsonbuf, (unsigned int)nbytes);
  lwsl_debug("tempest_process read (%d) %s", nbytes, jsonbuf);
  
  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = (unsigned int) tv.tv_sec;
  unsigned int this_minute = this_second / 60;

  const cJSON *sn = cJSON_GetObjectItemCaseSensitive(json, "serial_number");
  const cJSON *msgtype = cJSON_GetObjectItemCaseSensitive(json, "type");
  const cJSON *obs = cJSON_GetObjectItemCaseSensitive(json, "obs");
  const cJSON *ob = cJSON_GetObjectItemCaseSensitive(json, "ob");

  lwsl_user("tempest_process msgtype %s\n", msgtype->valuestring);

  double speed = -1.0;
  double dir = -1.0;
  double gust;

  // {"serial_number":"ST-00057643","type":"rapid_wind","hub_sn":"HB-00073154","ob":[1668645409,0.18,4]}
  if (!strcmp(msgtype->valuestring, "rapid_wind")) {
    const cJSON *child = ob->child;
    speed = child->next->valuedouble; // meters/second
    dir = child->next->next->valuedouble;
    lwsl_user("tempest_process rapid_wind: ob ts %d speed %.2f direction %.0f\n", child->valueint, speed, dir);
    
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
    float speed_avg = 0.0, dir_avg = 0.0, dir_bias = 0.0;
    int south_count = 0;
    int samples = 0;
    for (int i = 0; i < TEMPEST_RECENT_BUF; i++) {
      if (tempest_recent_wind[i].sec <= tv.tv_sec - 120) continue;

      samples++;
      float tspeed = tempest_recent_wind[i].speed;
      float tdir = tempest_recent_wind[i].dir;
      speed_avg += tspeed;
      if (tspeed > gust) gust = tspeed;

      dir_avg += tdir;
      dir_bias += (tdir + ((tdir < 180.0) ? 180.0 : -180.0));
      if ((tdir > 90.0) && (tdir <= 270.0)) south_count++;
    }

    speed_avg /= samples;

    lwsl_user("tempest_process south %d dir_avg %.1f dir_bias %.2f / %d", south_count, dir_avg, dir_bias, samples);
    if (south_count > (samples/2))
      dir_avg /= samples; /* More than half are south-ish */
    else {
      dir_avg = (dir_bias / samples) - 180.0; /* More than half are north-ish */
      if (dir_avg < 0) dir_avg += 360.0;
    }

    tempest_last_samples.rapid_speed = speed;
    tempest_last_samples.rapid_speed_avg = speed_avg;
    tempest_last_samples.rapid_dir = dir;
    tempest_last_samples.rapid_dir_avg = dir_avg;
    
    sprintf(tempest_wind_msg, "{\"event\": \"tempest_update\", \"speed\": %4.1f, \"speed_avg\": %4.1f, \"gust\": %4.1f, \"dir\": %3.0f, \"dir_avg\": %3.0f}", speed, speed_avg, gust, dir, dir_avg);
    lwsl_user("tempest_process samples %d source_count %d %s\n", samples, south_count, tempest_wind_msg);
    tempest_wind_len = strlen(tempest_wind_msg);
    
    new_publication |= SUBSCRIBE_TEMPEST_WIND;
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

    lwsl_user("ob_st ts %d avg %.1f gust %.1f dir %.0f battery %.1f interval %d\n", ts, wind_avg, wind_gust, wind_direction, wind_battery, wind_report_interval);
    tempest_last_samples.avg = wind_avg;
    tempest_last_samples.gust = wind_gust;
    tempest_last_samples.direction = wind_direction;
    tempest_last_samples.temp = wind_air_temperature;
    tempest_last_samples.baro = wind_station_pressure;
  }

  unsigned int index = (this_minute % HIST_ENTRIES);
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
	       
      lwsl_user("tempest history %d entries length %d", TEMPEST_HIST_ENTRIES, tempest_hist_len);
      lwsl_user("%s", tempest_hist_msg);
      new_publication |= SUBSCRIBE_TEMPEST_HIST;
    }
      
    tempest_hist[index].gust = 0;
    tempest_hist_last_minute = this_minute;
    lwsl_user("tempest_process new minute seconds %u index %d ", tv.tv_sec, index);

    unsigned long altm = airmar_last_timestamp / 60;
    if (this_minute > (altm + 1)) {
      lwsl_warn("no airmar data for %d minutes", this_minute - altm);
    }
  }

  if (new_publication & SUBSCRIBE_TEMPEST_WIND) {
    tempest_hist[index].sec = this_second;
    tempest_hist[index].speed = speed;
    if (gust > tempest_hist[index].gust) tempest_hist[index].gust = gust;
    tempest_hist[index].dir = dir;
  }
  
  cJSON_Delete(json);
  return new_publication;
}

unsigned int airmar_save()
{
  FILE *fd = fopen(AIRMAR_SAVE_FILE, "w");
  int count = 0;
  int h = (airmar_hist_index + 1) % HIST_ENTRIES;
  unsigned long lastts = 0;
  
  if (fd == NULL) {
    lwsl_err("airmar_save() Couldn't open airmar save file %s\n", AIRMAR_SAVE_FILE);
    return(0);
  }
  while (h != airmar_hist_index) {
    if ((airmar_hist[h].ts != 0) && (airmar_hist[h].ts > lastts)) {
      fprintf(fd, "%lu %5.1f %5.1f %3.0f\n", airmar_hist[h].ts, airmar_hist[h].speed, airmar_hist[h].gust, airmar_hist[h].dir);
      count++;
      lastts = airmar_hist[h].ts;
    }
    h = (h + 1) % HIST_ENTRIES;
  }
  fclose(fd);
  lwsl_notice("airmar_save() %d entries\n", count);
  return(0);
}

unsigned int secs2iso(char *buf, int len, unsigned long ts) {
    struct timeval tv;
    tv.tv_sec = ts;
    tv.tv_usec = 0;
    strftime(buf, len, "%Y-%m-%d %H:%M:%S", localtime((const time_t *) &tv));
}

unsigned int secs2shortduration(char *buf, int len, unsigned long ts) {
    unsigned long hours = ts / (60*60);
    unsigned minutes = (ts / 60) % 60;
    unsigned seconds = ts % 60;
    sprintf(buf, "%lu:%02u:%02u", hours, minutes, seconds);
}

unsigned int airmar_restore()
{
  int h = -1, count = 0;
  unsigned int ts, lastts = 0;
  float speed, gust, dir;
  FILE *fd = fopen(AIRMAR_SAVE_FILE, "r");
  char rbuf[1024];

  if (fd == NULL) {
    lwsl_err("airmar_restore() Couldn't open airmar save file %s\n", AIRMAR_SAVE_FILE);
    return(0);
  }

  while (fgets(rbuf, sizeof(rbuf), fd)) {
    int n = sscanf(rbuf, "%lu %f %f %f", &ts, &speed, &gust, &dir);
    if ((n == 4) && (ts > lastts)) {
      h = (h + 1) % HIST_ENTRIES;
      airmar_hist[h].ts = ts;
      airmar_hist[h].speed = speed;
      gust = (gust >= speed) ? gust : speed;
      airmar_hist[h].gust = gust;
      airmar_hist[h].dir = dir;
      count++;
    }
  }
  fclose(fd);
  lwsl_notice("airmar_restore() %d entries\n", count);
  airmar_hist_index = (h < 0) ? 0: h;
  if (count > 0) {
    char tbuf[20];
    airmar_last_good_sample = ts;
    secs2iso(tbuf, sizeof(tbuf), ts);
    lwsl_notice("airmar_restore() last sample %s\n", tbuf);
    struct timeval now;
    gettimeofday(&now, NULL);
    unsigned int this_second = now.tv_sec;
    unsigned int diff = this_second - ts;
    if (diff > (60 * 60)) airmar_reboot_timeout = (15 * 60);
    if (diff > (2 * 60 * 60)) airmar_reboot_timeout = (60 * 60);
    if (diff > (6 * 60 * 60)) airmar_reboot_timeout = (6 * 60 * 60);
    if (diff > (24 * 60)) airmar_reboot_timeout = (24 * 60 * 60);
    char since[32], timeout[32];
    secs2shortduration(since, sizeof(32), diff);
    secs2shortduration(timeout, sizeof(32), airmar_reboot_timeout);
    lwsl_notice("airmar_restore no sample for %s - setting reboot timeout to %s", since, timeout);
  }
  return(0);
}

unsigned int airmar_power(char *onoff) {
  int pid = fork();
  if (!pid) {
    char *argv[] = {
      AIRMAR_POWER_PATH,
      onoff,
      NULL
    };
    char *envp[] = { NULL };
    execve(AIRMAR_POWER_PATH, argv, envp);
    lwsl_err("airmar_power() execve() failed %d %s\n", errno, strerror(errno));
    exit(-1);
  }
  lwsl_notice("airmar_power() powering airmar %s\n", onoff);
  int status;
  waitpid(pid, &status, 0);
  lwsl_notice("airmar_power() status %d\n", status);
}

unsigned int airmar_check()
{
  int pid;

#if CHECK_AIRMAR > 0
  /* If we're already rebooting, don't bother to check further */
  if (airmar_rebooting) return(0);
  
  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = tv.tv_sec;
  unsigned int this_minute = this_second / 60;

  int timeout = (this_second >= airmar_last_good_sample + airmar_reboot_timeout); // Haven't heard from it for a while
  int high_gust = (airmar_high_gust > 90.0); // Once the Airmar sends a 99.9kt gust it tends to hang
  int read_error = (airmar_bad_read > 255); // Sometimes the Airmar/USB starts returning error 11 - power cycle seems to fix it

  if (!(timeout || high_gust || read_error)) return(0);
  if (high_gust) lwsl_notice("airmar_check High gust %d %f (%d)", high_gust, airmar_high_gust, airmar_rebooting);
  if (timeout) {
    char buf[20], buf2[20];

    secs2iso(buf, sizeof(buf), this_second);
    secs2iso(buf2, sizeof(buf2), airmar_last_good_sample);
    lwsl_notice("airmar_check now %s last good %s", buf, buf2);
    secs2shortduration(buf, sizeof(buf), this_second - airmar_last_good_sample);
    lwsl_notice("airmar_check Timeout %d  not for %s (%d)", timeout, buf, airmar_rebooting);
  }
  if (read_error) lwsl_notice("airmar_check Read Error Count %d (%d)", airmar_bad_read, airmar_rebooting);
  if (this_second <= sensord_start + airmar_reboot_timeout) {
    lwsl_notice("Cancelling reboot - haven't run long enough");
    return(0);
  }

  pid = fork();
  if (!pid) {
    char *argv[] = {
      AIRMAR_REBOOT_PATH,
      NULL
    };
    char *envp[] = { NULL };
    execve(AIRMAR_REBOOT_PATH, argv, envp);
    lwsl_err("airmar_check() execve() failed %d %s\n", errno, strerror(errno));
    exit(-1);
  }
  lwsl_notice("airmar_check() rebooting Airmar (%d, %d, %d, %d) and system pid %d\n", timeout, high_gust, read_error, airmar_rebooting, pid);
  airmar_rebooting = 1;
#endif
  return(0);
}

unsigned int airmar_init(struct lws *wsi, void *user)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  int fd = -1;
  lws_sock_file_fd_type u;

#if AIRMAR_CHECK > 0
  int i = airmar_power("on");
#endif

  airmar_restore();
  
  airmar_wind_msg = &airmar_wind_msgbuf[LWS_PRE];
  airmar_hist_msg = &airmar_hist_msgbuf[LWS_PRE];

  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = tv.tv_sec;
  unsigned int this_minute = this_second / 60;

  airmar_first_timestamp = this_second;
  airmar_last_timestamp = this_second;
  
  for (int i = 0; i < sizeof(airmartty)/sizeof(char *); i++) {
    airmarfn = airmartty[i];
    lwsl_notice("Opening Airmar source[%d] -  %s\n", i, airmarfn);
    if ((fd = lws_open(airmarfn, O_RDWR)) < 0) {
      lwsl_err("Unable to open Airmar source %s\n", airmarfn);
    } else {
      break;
    }
  }
  if (fd < 0) {
    lwsl_err("Unable to open any Airmar source\n");
    return 1;
  }

  lwsl_notice("Airmar %s fd %d %d", airmarfn, fd, sizeof(airmartty));
  vhd->airmar_fd = fd;
  
  struct termios tty;
  memset(&tty, 0, sizeof(struct termios));
  if(tcgetattr(fd, &tty) != 0) {
    lwsl_user("Error %i from tcgetattr: %s\n", errno, strerror(errno));
  }

  cfmakeraw(&tty);
  tty.c_iflag |= IGNPAR | IUTF8;
  tty.c_cflag |= CS8;
  tty.c_cflag &= ~CSTOPB;
  tty.c_cflag |= CRTSCTS;
  tty.c_lflag |= ICANON; // Turn on canonical mode - let the driver wait for a <cr> before returning

  // Airmar is 4800 baud
  cfsetispeed(&tty, B4800);
  cfsetospeed(&tty, B4800);

  if (tcsetattr(fd, TCSANOW, &tty) != 0) {
    lwsl_err("Error %i from tcsetattr: %s\n", errno, strerror(errno));
    return 1;
  }

  //char *airmar_init_string = "$PAMTX,0\015\012"; // Disable all transmissions
  char *airmar_init_strings[] = {
			       "$PAMTC,RESET\015\012", // Enable all transmissions
			       "$PAMTX,1\015\012", // Enable all transmissions
  };
  
  for (int i = 0; i < sizeof(airmar_init_strings) / sizeof(char *); i++) {
      int r;
      if (r = write(fd, airmar_init_strings[i], strlen(airmar_init_strings[i]) < 0)) {
	lwsl_err("Airmar Init string write %s returned %d\n", airmar_init_strings[i], r);
      }
  }
    
  u.filefd = (lws_filefd_type)(long long)fd;
  if (!lws_adopt_descriptor_vhost(lws_get_vhost(wsi),
				  LWS_ADOPT_RAW_FILE_DESC, u, "wind", NULL)) {
    lwsl_err("Failed to adopt serial port file descriptor\n");
    close(vhd->airmar_fd);
    vhd->airmar_fd = -1;
    
    return 1;
  }
  lwsl_notice("airmar_init: airmar %s socket fd %d\n", airmarfn, fd);
  return 0;
}

unsigned int
airmar_process(struct lws *wsi, void *user)
{
  struct per_session_data__wind *pss = (struct per_session_data__wind *)user;
  struct per_vhost_data__wind *vhd =
    (struct per_vhost_data__wind *) lws_protocol_vh_priv_get(lws_get_vhost(wsi), lws_get_protocol(wsi));

  uint8_t buf[128];
  
  unsigned int new_publication = SUBSCRIBE_NONE;
  int n;

  /* Read and parse a text line from the weather station, tell clients there's data to send */
  // lwsl_user("airmar_process %d\n");
  if ((n = (int)read(vhd->airmar_fd, buf, sizeof(buf))) <= 0) {
    lwsl_err("Reading from %s failed %d: %s\n", airmarfn, errno, strerror(errno));
    airmar_bad_read++;
    return 1;
  }
    
  buf[n] = 0;
		
  float awa, aws;
  float twa_t, twa_m, tws_n, tws_m;
  float baro_i, baro_m, temp;
  char twa_t_ref, twa_m_ref, tws_n_unit, tws_m_unit, awa_ref, aws_unit, baro_i_unit, baro_m_unit, temp_unit;
  float speed, dir;

  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = tv.tv_sec;
  unsigned int this_minute = this_second / 60;
  airmar_last_timestamp = this_second;
    
  if (airmar_last_timestamp - airmar_first_timestamp < 2) {
    /* print first N seconds of data at log level "notice" */
    lwsl_notice("airmar_process read (%d) %s", n, buf);
    lwsl_hexdump_level(LLL_NOTICE, buf, (unsigned int)n);
  } else {
    /* print later input at log level "debug" */
    //lwsl_user("airmar_process read (%d) %s", n, buf);
    //lwsl_hexdump_level(LLL_DEBUG, buf, (unsigned int)n);
  }
  
  /* Regular sentences from the Airmar PB-200
   * $GPZDA,233202,27,03,2003,00,00*4D
   * $GPGGA,233202,3748.4418,N,12226.7771,W,2,9,0.9,12.6,M,,,,*05
   * $WIMDA,29.3262,I,0.9931,B,14.5,C,,,,,,,314.1,T,299.1,M,4.1,N,2.1,M*24
   * $WIMWD,314.1,T,299.1,M,4.1,N,2.1,M*58
   * $WIMWV,199.4,R,4.0,N,A*22
   * $WIMWV,200.8,T,4.0,N,A*2B
   */

  speed = -1;
  dir = -1;
    
  // $WIMWD,314.1,T,299.1,M,4.1,N,2.1,M*58
  if (!strncmp((const char *)&buf, "$WIMWD", sizeof("$WIMWD")-1)) {
    int r = sscanf(buf, "$WIMWD,%f,%c,%f,%c,%f,%c,%f,%c", &twa_t, &twa_t_ref, &twa_m, &twa_m_ref, &tws_n, &tws_n_unit, &tws_m, &tws_m_unit);
    if ((r != 8) || (twa_m_ref != 'M') || (tws_n_unit != 'N')) {
      //lwsl_user("$WIMWD Bad Parse %d %c %c %s", r, twa_m_ref, tws_m_unit, buf);
    } else {
      airmar_last_samples.twa = twa_m;
      airmar_last_samples.tws = tws_n;
      if (0) {
	speed = tws_n;
	dir = twa_m;
	new_publication |= SUBSCRIBE_AIRMAR_WIND;
      }
    }
  }

  // $WIMWV comes in two flavors: R - relative & T - theoretical (calculated to be True)
  // $WIMWV,201.8,R,4.4,N,A*28
  // $WIMWV,261.6,T,15.4,N,A*16
  if (!strncmp((const char *)&buf, "$WIMWV", sizeof("$WIMWV")-1)) {
    int r = sscanf(buf, "$WIMWV,%f,%c,%f,%c,", &awa, &awa_ref, &aws, &aws_unit);
    if ((r == 4) && (awa_ref == 'R') && (aws_unit == 'N')) {
      // Adjust reading for sensor not pointing north
      awa += SENSOR_OFFSET;
      awa = (awa < 360.0) ? awa : awa - 360.0;
      awa = (awa < 0.0) ? awa + 360 : awa;
      
      airmar_last_samples.awa = awa;
      airmar_last_samples.aws = aws;
      //lwsl_user("airmar update rel  %3.0f @ %4.1f\n", awa, aws);
      if (SOURCE == AIRMAR_APPARENT) {
	speed = aws;
	dir = awa;
	new_publication |= SUBSCRIBE_AIRMAR_WIND;
      }
    } else if ((r == 4) && (awa_ref == 'T') && (aws_unit == 'N')) {
      awa = (awa < 360.0) ? awa : awa - 360.0;
      
      airmar_last_samples.twa = awa;
      airmar_last_samples.tws = aws;
      //lwsl_user("airmar update true %3.0f @ %4.1f\n", awa, aws);
      if (SOURCE == AIRMAR_TRUE) {
	speed = aws;
	dir = awa;
	new_publication |= SUBSCRIBE_AIRMAR_WIND;
      }

    }else {
      lwsl_user("$WIMWV Bad Parse %d %c %c %s", r, awa_ref, aws_unit, buf);
    }
  }

  // $WIMDA,29.3262,I,0.9931,B,14.5,C,,,,,,,314.1,T,299.1,M,4.1,N,2.1,M*24
  // $WIMDA,29.4384,I,0.9969,B,20.1,C,,,,,,,37.7,T,22.7,M,7.7,N,4.0,M*26
  // $WIMDA,29.9936,I,1.0157,B,14.5,C,,,,,,,,,,,,,,*3C - 110WX sentence doesn't have the true wind data
  if (!strncmp((const char *)&buf, "$WIMDA", sizeof("$WIMDA")-1)) {
    int good_parse = 0;
    int r = sscanf(buf, "$WIMDA,%f,%c,%f,%c,%f,%c,,,,,,,,,,,,,,", &baro_i, &baro_i_unit, &baro_m, &baro_m_unit, &temp, &temp_unit);
    good_parse = (r == 6);
    if (!good_parse) {
      r = sscanf(buf, "$WIMDA,%f,%c,%f,%c,%f,%c,,,,,,,%f,%c,%f,%c,%f,%c,%f,%c", &baro_i, &baro_i_unit, &baro_m, &baro_m_unit, &temp, &temp_unit, &twa_t, &twa_t_ref, &twa_m, &twa_m_ref, &tws_n, &tws_n_unit, &tws_m, &tws_m_unit);
      good_parse = (r == 14);
    }
    if (!good_parse || (baro_m_unit != 'B') || (temp_unit != 'C')) {
      lwsl_user("$WIMDA Bad Parse %d %c %c %s", r, baro_m_unit, temp_unit, buf);
    } else {
      airmar_last_samples.baro = baro_m * 1000.0;
      airmar_last_samples.temp = ((temp * 9.0) / 5.0) + 32.0;
    }
  }
    
  // Return if this wasn't the sentence we're using for wind source
  if (new_publication == SUBSCRIBE_NONE) return 0;

  //lwsl_user("airmar dir %3.0f @ %.1f\n", dir, speed);

  airmar_recent_idx = (airmar_recent_idx + 1) % AIRMAR_RECENT;
  airmar_recent[airmar_recent_idx].sec = this_second;
  airmar_recent[airmar_recent_idx].speed = speed;
  airmar_recent[airmar_recent_idx].dir = dir;
    
  /* Determine average wind angle - what happens when wind is oscillating from dead ahead?
   * If some samples are slightly positive and others are 'negative' (close to 360) then
   * the average is close to 180! This is not zero, as it should be. So keep track of a total
   * of the angles + 180 degrees - more samples are 'north' use the biased total, otherwise
   * use the unbiased total.
   */
  float aws_avg = 0.0, gust = 0.0, awa_avg = 0.0, awa_bias = 0.0;
  int south_count = 0;
  int sample_count = 0;
  for (int i = 0; i < AIRMAR_RECENT; i++) {
    if (airmar_recent[i].sec <= (this_second - AIRMAR_WINDSPEED_SECONDS)) continue;
    sample_count++;
    aws_avg += airmar_recent[i].speed;

    float s = airmar_recent[i].dir;
    awa_avg += s;
    awa_bias += (s + ((s < 180.0) ? 180.0 : -180.0));
    if ((s > 90.0) && (s <= 270.0)) south_count++;

    // We used to look for the highest speed in the last WINDSPEED_SECONDS
    // gust = (airmar_recent[i].speed > gust) ? airmar_recent[i].speed : gust;

  }
  aws_avg /= sample_count;
  
  // Now look for the highest average GUST_SAMPLES window in the GUST_SECONDS history
  int start_sec = airmar_recent[airmar_recent_idx].sec;
  int start_idx = airmar_recent_idx;
#ifdef AIRMAR_GUST_DEBUG
  int gust_debug = ((airmar_recent[airmar_recent_idx].sec % 10) == 0) && AIRMAR_GUST_DEBUG;
  if (gust_debug) {
    lwsl_info("AIRMAR_GUST_START");
  }
#endif
    
  while (airmar_recent[airmar_recent_idx].sec - airmar_recent[start_idx].sec < AIRMAR_GUST_WINDOW) {
    int gust_sample_count = 0;
    int gust_total = 0;
    for (int i = 0; i < AIRMAR_GUST_SAMPLES; i++) {
      int idx = (start_idx - i) % AIRMAR_RECENT;
      if (start_sec - airmar_recent[idx].sec < AIRMAR_GUST_WINDOW) {
	gust_total += airmar_recent[idx].speed;
	gust_sample_count++;
      }
      gust_total /= gust_sample_count;
      if (gust_total > gust) {
	gust = gust_total;
#ifdef AIRMAR_GUST_DEBUG
	if (gust_debug) {
	  lwsl_info("AIRMAR_GUST %d %.1f", start_idx, gust);
	}
#endif
      }
    }
    start_idx = (start_idx - 1) % AIRMAR_RECENT;
  }
#ifdef AIRMAR_GUST_DEBUG
    if (gust_debug) {
      lwsl_info("AIRMAR_GUST_FINISH %.1f", gust);
    }
#endif

  if (south_count > (sample_count/2))
    awa_avg /= sample_count; /* More than half are south-ish */
  else {
    //lwsl_notice("south %d awa %.1f awa_bias %.2f / %d = avg %.0f", south_count, awa, awa_bias, RECENT_BUF, awa_bias/RECENT_BUF);
    awa_avg = (awa_bias / sample_count) - 180.0; /* More than half are north-ish */
    awa_avg = (awa_avg >= 0.0) ? awa_avg : awa_avg + 360.0;
  }

  airmar_high_gust = (gust > airmar_high_gust) ? gust : airmar_high_gust;
  airmar_last_good_sample = this_second;
  
  sprintf(airmar_wind_msg, "{\"event\": \"airmar_update\", \"speed\": %4.1f, \"speed_avg\": %4.1f, \"gust\": %4.1f, \"dir\": %3.0f, \"dir_avg\": %3.0f}", speed, aws_avg, gust, dir, awa_avg);
  airmar_wind_len = strlen(airmar_wind_msg);

  //lwsl_user("airmar samples %d south_count %d %s\n", sample_count, south_count, airmar_wind_msg);

  // Use the data in this bucket before we reassign it to the new minute
  if (this_minute != airmar_hist_last_minute) {
    if (!(this_minute % AIRMAR_HIST_FREQUENCY)) {
      char entry[128];
      // Create history JSON buffer
      strcpy(airmar_hist_msg, "{ \"event\": \"airmar_history\"");
      sprintf(entry, ", \"baro\": %.1f", airmar_last_samples.baro);
      strcat(airmar_hist_msg, entry);
      sprintf(entry, ", \"temp\": %.1f", airmar_last_samples.temp);
      strcat(airmar_hist_msg, entry);
      sprintf(entry, ", \"airmar_tws\": %.1f", airmar_last_samples.tws);
      strcat(airmar_hist_msg, entry);
      sprintf(entry, ", \"airmar_twa\": %.1f", airmar_last_samples.twa);
      strcat(airmar_hist_msg, entry);
      sprintf(entry, ", \"airmar_aws\": %.1f", airmar_last_samples.aws);
      strcat(airmar_hist_msg, entry);
      sprintf(entry, ", \"airmar_awa\": %.1f", airmar_last_samples.awa);
      strcat(airmar_hist_msg, entry);
      strcat(airmar_hist_msg, ", \"history\": [");
      for (int i = 0; i < HIST_ENTRIES; i++) { // BARF - this is n^2 in HIST_ENTRIES
	int h = (airmar_hist_index + i + 1) % HIST_ENTRIES;
	if (airmar_hist[h].ts != 0) {
	  sprintf(entry, AIRMAR_HIST_ENTRY_JSON, airmar_hist[h].ts, airmar_hist[h].speed, airmar_hist[h].gust, airmar_hist[h].dir);
	  strcat(airmar_hist_msg, entry);
	}
      }
      airmar_hist_msg[strlen(airmar_hist_msg) - 1] = 0; // Chomp off the trailing comma
      strcat(airmar_hist_msg, "]");
      strcat(airmar_hist_msg, "}");
      airmar_hist_len = strlen(airmar_hist_msg);
      //lwsl_user("airmar history %d entries length %d", HIST_ENTRIES, airmar_hist_len);
      //lwsl_user("%s", airmar_hist_msg);
      new_publication |= SUBSCRIBE_AIRMAR_HIST;
      airmar_hist_index = (airmar_hist_index + 1) % HIST_ENTRIES;
    }
    
    int index = airmar_hist_index;
    airmar_hist[index].gust = 0;
    airmar_hist_last_minute = this_minute;
    //lwsl_user("new minute seconds %u index %d ", tv.tv_sec, index);

    if (airmar_last_save == 0) {
      airmar_last_save = this_minute;
    }

    if (this_minute >= (airmar_last_save + AIRMAR_SAVE_FREQ)) {
      airmar_save();
      airmar_last_save = this_minute;
    }
  }

  if (new_publication & SUBSCRIBE_AIRMAR_WIND) {
    int index = airmar_hist_index;
    airmar_hist[index].ts = this_minute * 60;
    airmar_hist[index].speed = aws_avg;
    airmar_hist[index].dir = awa_avg;
    if (gust > airmar_hist[index].gust)
      airmar_hist[index].gust = gust;
  }
  
  return new_publication;
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

  airmar_check(); // Check airmar health as often as possible

  switch (reason) {
  case LWS_CALLBACK_PROTOCOL_INIT:
    lwsl_notice("LWS_CALLBACK_PROTOCOL_INIT: wsi %p\n", wsi);
    vhd = lws_protocol_vh_priv_zalloc(lws_get_vhost(wsi),
				      lws_get_protocol(wsi),
				      sizeof(struct per_vhost_data__wind));
    vhd->context = lws_get_context(wsi);
    vhd->protocol = lws_get_protocol(wsi);
    vhd->vhost = lws_get_vhost(wsi);

    if (HAS_TEMPEST) tempest_init(wsi, user);
    if (HAS_AIRMAR) airmar_init(wsi, user);

    break;

  case LWS_CALLBACK_PROTOCOL_DESTROY:
    lwsl_notice("LWS_CALLBACK_PROTOCAL_DESTROY: wsi %p\n", wsi);
    if (vhd->tempest_sock != -1)
      close(vhd->tempest_sock);
    if (vhd->airmar_fd != -1)
      close(vhd->airmar_fd);
    break;

  case LWS_CALLBACK_ESTABLISHED:
    /* add ourselves to the list of websocket clients */
    lwsl_notice("LWS_CALLBACK_ESTABLISHED: wsi %p\n", wsi);
    lws_ll_fwd_insert(pss, pss_list, vhd->pss_list);
    pss->wsi = wsi;
    //pss->last = vhd->current;
    break;

  case LWS_CALLBACK_CLOSED:
    /* remove ourselves from the client list */
    lwsl_notice("LWS_CALLBACK_CLOSED: wsi %p\n", wsi);
    lws_ll_fwd_remove(struct per_session_data__wind, pss_list, pss, vhd->pss_list);
    break;

  case LWS_CALLBACK_SERVER_WRITEABLE:
    // Write only one message per callback
    
    if (pss->needs & SUBSCRIBE_TEMPEST_HIST) {
      //lwsl_user("Sending tempest history");
      if ((m = lws_write(wsi, tempest_hist_msg, tempest_hist_len, LWS_WRITE_TEXT)) < tempest_hist_len) {
	lwsl_err("ERROR %d writing tempest history to ws socket\n", m);
	return -1;
      }
      pss->needs &= ~SUBSCRIBE_TEMPEST_HIST;
      if (pss->needs) lws_callback_on_writable(pss->wsi); // Still need something else
      break;
    }
    
    if (pss->needs & SUBSCRIBE_TEMPEST_WIND) {
      //lwsl_user("Sending tempest update %s\n", tempest_hist_msg);
      m = lws_write(wsi, tempest_wind_msg, tempest_wind_len, LWS_WRITE_TEXT);
      if (m < tempest_wind_len) {
	lwsl_err("ERROR %d writing tempest wind to ws socket\n", m);
	return -1;
      }
      pss->needs &= ~SUBSCRIBE_TEMPEST_WIND;
      if (pss->needs) lws_callback_on_writable(pss->wsi); // Still need something else
      break;
    }

    if (pss->needs & SUBSCRIBE_AIRMAR_HIST) {
      //lwsl_user("Sending airmar history");
      if ((m = lws_write(wsi, airmar_hist_msg, airmar_hist_len, LWS_WRITE_TEXT)) < airmar_hist_len) {
	lwsl_err("ERROR %d writing airmar history (%d) to ws socket\n", m, airmar_hist_len);
	return -1;
      }
      pss->needs &= ~SUBSCRIBE_AIRMAR_HIST;
      //lwsl_user("Sending airmar history %s needs 0x%x\n", airmar_hist_msg, pss->needs);
      if (pss->needs) lws_callback_on_writable(pss->wsi); // Still need something else
      break;
    }
    
    if (pss->needs & SUBSCRIBE_AIRMAR_WIND) {
      // lwsl_user("Sending airmar update %s\n", airmar_wind_msg);
      if ((m = lws_write(wsi, airmar_wind_msg, airmar_wind_len, LWS_WRITE_TEXT)) < airmar_wind_len) {
	lwsl_err("ERROR %d writing airmar wind (%d) to ws socket\n", m, airmar_wind_len);
	return -1;
      }
      pss->needs &= ~SUBSCRIBE_AIRMAR_WIND;
      //lwsl_user("Sending airmar update %s needs 0x%x\n", airmar_wind_msg, pss->needs);
      if (pss->needs) lws_callback_on_writable(pss->wsi); // Still need something else
      break;
    }

    if (pss->needs) {
      lwsl_notice("LWS_CALLBACK_SERVER_WRITEABLE clearing needs %d\n", pss->needs);
      pss->needs = SUBSCRIBE_NONE;
    }
    break;

  case LWS_CALLBACK_RECEIVE:
    /* A client is sending us something - probably a subscription request */
    //((char *)in)[len+1] = 0; // Not zero terminated! - But adding a \0 breaks libwebsockets somehow.
    // Could copy to a static buffer and zero terminate it I suppose
    //lwsl_debug("LWS_CALLBACK_RECEIVE cJSON (len %d) %s\n", len, in);
    lwsl_notice("LWS_CALLBACK_RECEIVE cJSON (len %d) %s\n", len, in);
    json = cJSON_ParseWithLength(in, len);
    if (json == NULL) {
      lwsl_err("LWS_CALLBACK_RECEIVE cJSON couldn't parse (len %d) %s\n", len, in);
      break;
    }

    const cJSON *tempest_wind = cJSON_GetObjectItemCaseSensitive(json, "subscribe_tempest_wind");
    const cJSON *tempest_history = cJSON_GetObjectItemCaseSensitive(json, "subscribe_tempest_history");
    const cJSON *airmar_wind = cJSON_GetObjectItemCaseSensitive(json, "subscribe_airmar_wind");
    const cJSON *airmar_history = cJSON_GetObjectItemCaseSensitive(json, "subscribe_airmar_history");

    if (tempest_wind != NULL) {
      if (cJSON_IsBool(tempest_wind)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_tempest_wind %d\n", tempest_wind->valueint);
	if (tempest_wind->valueint == 1) {
	  pss->subscriptions |= SUBSCRIBE_TEMPEST_WIND;
	} else {
	  pss->subscriptions &= ~SUBSCRIBE_TEMPEST_WIND;
	}
	lwsl_notice("LWS_CALLBACK_RECEIVE subscriptions %d\n", pss->subscriptions);
      }
    }

    if (tempest_history != NULL) {
      if (cJSON_IsBool(tempest_history)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_tempest_history %d\n", tempest_history->valueint);
	if (tempest_history->valueint == 1) {
	  pss->subscriptions |= SUBSCRIBE_TEMPEST_HIST;
	  pss->needs |= SUBSCRIBE_TEMPEST_HIST;
	  lws_callback_on_writable(pss->wsi);
	} else {
	  pss->subscriptions &= ~SUBSCRIBE_TEMPEST_HIST;
	}
	lwsl_notice("LWS_CALLBACK_RECEIVE subscriptions %d\n", pss->subscriptions);
      }
    }

    if (airmar_wind != NULL) {
      if (cJSON_IsBool(airmar_wind)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_airmar_wind %d\n", airmar_wind->valueint);
	if (airmar_wind->valueint == 1) {
	  pss->subscriptions |= SUBSCRIBE_AIRMAR_WIND;
	} else {
	  pss->subscriptions &= ~SUBSCRIBE_AIRMAR_WIND;
	}
	lwsl_notice("LWS_CALLBACK_RECEIVE subscriptions %d\n", pss->subscriptions);
      }
    }

    if (airmar_history != NULL) {
      if (cJSON_IsBool(airmar_history)) {
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_airmar_history %d\n", airmar_history->valueint);
	if (airmar_history->valueint == 1) {
	  pss->subscriptions |= SUBSCRIBE_AIRMAR_HIST;
	  pss->needs |= SUBSCRIBE_AIRMAR_HIST;
	  lws_callback_on_writable(pss->wsi);
	} else {
	  pss->subscriptions &= ~SUBSCRIBE_AIRMAR_HIST;
	}
	lwsl_notice("LWS_CALLBACK_RECEIVE subscriptions %d\n", pss->subscriptions);
      }
    }

    cJSON_Delete(json);
    break;

  case LWS_CALLBACK_RAW_ADOPT_FILE:
    lwsl_notice("LWS_CALLBACK_RAW_ADOPT_FILE\n");
    break;

  case LWS_CALLBACK_RAW_RX_FILE:
    /* One of our sensors has new data - either the Airmar serial port or the Tempest
     * has sent a broadcast packet.
     */
    lwsl_user("LWS_CALLBACK_RAW_RX_FILE len %d\n", len);

    unsigned int new_pubs = SUBSCRIBE_NONE;
    
    /* LWS doesn't tell us the fd that has input - maybe there's an API call
     * buried somewhere. Instead, use a select() polling call to see which
     * fd is ready.
     */
    struct timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 0;

    fd_set fds;
    unsigned long *p = (unsigned long *)&fds;
    *p = 0;
    //lwsl_user("Select zero 0x%x", *p);
    //FD_ZERO(&fds);
    //lwsl_user("Select zero %d", __FDS_BITS(&fds));
    FD_SET(vhd->tempest_sock, &fds);
    FD_SET(vhd->airmar_fd, &fds);
    //lwsl_user("Select post set 0x%x", *p);
    int highsock = ((vhd->tempest_sock > vhd->airmar_fd)? vhd->tempest_sock : vhd->airmar_fd) + 1;

    //lwsl_user("Select highsock %d 0x%x", highsock, *p);
    int ret;
    if ((ret = select(highsock, &fds, NULL, NULL, &timeout)) < 0) {
      lwsl_user("LWS_CALLBACK_RAW_RX_FILE select %d errno %d\n", ret, errno);
      break;
    }

    //lwsl_user("Select returns %d 0x%x", ret,*p);

    if (FD_ISSET(vhd->tempest_sock, &fds)) new_pubs |= tempest_process(wsi, user);
    if (FD_ISSET(vhd->airmar_fd, &fds)) new_pubs |= airmar_process(wsi, user);

    /* Enable writing on clients subscribed to the new data */
    lws_start_foreach_llp(struct per_session_data__wind **,
			  ppss, vhd->pss_list) {
      (*ppss)->needs |= ((*ppss)->subscriptions & new_pubs);
      if ((*ppss)->needs != SUBSCRIBE_NONE) {
	//lwsl_user("Client needs 0x%x", (*ppss)->needs);
	lws_callback_on_writable((*ppss)->wsi);
      }
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
  /*  { "wind", callback_wind, sizeof(struct per_session_data__wind), 0, 0, NULL, 0 }, */
  { "wind", callback_wind, sizeof(struct per_session_data__wind), 65535, 0, NULL, 0 },
  LWS_PROTOCOL_LIST_TERM
};

/*
 * this sets a per-vhost, per-protocol option name:value pair
 * the effect is to set this protocol to be the default one for the vhost,
 * ie, selected if no Protocol: header is sent with the ws upgrade.
 */

static int interrupted;

void sigint_handler(int sig)
{
  interrupted = 1;
}

int main(int argc, const char **argv)
{
  struct timeval tv;
  gettimeofday(&tv, NULL);
  unsigned int this_second = tv.tv_sec;
  unsigned int this_minute = this_second / 60;
  sensord_start = this_second;

  struct lws_context_creation_info info;
  struct lws_context *context;
  const char *p;
  int n = 0, logs = LLL_ERR | LLL_WARN | LLL_NOTICE
    /* for LLL_ verbosity above NOTICE to be built into lws,
     * lws must have been configured and built with
     * -DCMAKE_BUILD_TYPE=DEBUG instead of =RELEASE */
    /* | LLL_INFO */ /* | LLL_PARSER */ /* | LLL_HEADER */
    /* | LLL_EXT */ /* | LLL_CLIENT */ /* | LLL_LATENCY */
    /* | LLL_DEBUG */;

  /* There are also a number of messages at LLL_DEBUG & LLL_USER */

#if 0
#define LLL_ERR			(1 << 0)
#define	LLL_WARN		(1 << 1)
#define	LLL_NOTICE		(1 << 2)
#define	LLL_INFO		(1 << 3)
#define	LLL_DEBUG		(1 << 4)
#define	LLL_PARSER		(1 << 5)
#define	LLL_HEADER		(1 << 6)
#define	LLL_EXT			(1 << 7)
#define	LLL_CLIENT		(1 << 8)
#define	LLL_LATENCY		(1 << 9)
#define	LLL_USER		(1 << 10)
#define	LLL_THREAD		(1 << 11)
#endif
  
  signal(SIGINT, sigint_handler);

  if ((p = lws_cmdline_option(argc, argv, "-d")))
    logs = atoi(p);

  lws_set_log_level(logs, NULL);
  lwsl_notice("LWS Serve up wind from WeatherFlow Tempest & Airmar NMEA-0183 wind instruments");
  lwsl_notice("LWS log level 0x%x (%d)", logs, logs);

  signal(SIGINT, sigint_handler);

  memset(&info, 0, sizeof info);
  info.port = PORT;
  info.protocols = protocols;

  context = lws_create_context(&info);
  if (!context) {
    lwsl_err("lws init failed\n");
    return 1;
  }

  while (n >= 0 && !interrupted)
    n = lws_service(context, 0);

  lws_context_destroy(context);

  return 0;
}
