/*
 * Read NMEA-0183 sentences from an Airmar weatherstation on /dev/ttyUSB0
 * Publish wind data to interested parties via a websocket
 */

#include <libwebsockets.h>
#include <stdlib.h>
#include <stdio.h>
#include <signal.h>
#include <fcntl.h>
#include <string.h>
#include <termios.h> // Contains POSIX terminal control definitions
#include <cjson/cJSON.h>

#if !defined (LWS_PLUGIN_STATIC)
#define LWS_DLL
#define LWS_INTERNAL
#endif

// Our sensor is not pointed north - add SENSOR_OFFSET to each reading
#define SENSOR_OFFSET 75.0

// 8000 + 0183 - why not?
#define PORT 8183

// json payload + websocket preamble - should be small, but only one is allocated
#define MSGBUF 64536

// Number of entires in history
#define HIST_ENTRIES (6*60)
#define HIST_ENTRY_JSON "{\"ts\": %u, \"aws\": %4.1f, \"gust\": %4.1f, \"awa\": %5.1f},"
// Minutes between history updates
#define HIST_FREQUENCY 1

struct hist {
  unsigned long ts;
  float aws;
  float gust;
  float awa;
} wind_hist[HIST_ENTRIES]; // six hours of wind history

int hist_size;
char *hist_buf;
int hist_last_minute;
int hist_entry_json_len;

/* should the buffer be in the vhd? */
#define RECENT_BUF 120
float aws_buf[RECENT_BUF];
float awa_buf[RECENT_BUF];
int buf_idx = 0;

static char nmeafn[] = "/dev/ttyUSB0";

/* websocket client state */
struct per_session_data__wind {
  struct per_session_data__wind *pss_list; /* linked list to next client */
  struct lws *wsi;
  int needs_history;
  int subscribe_history;
  int subscribe_wind;
};

/* one of these is created for each vhost our protocol is used with */
struct per_vhost_data__wind {
  struct lws_context *context;
  struct lws_vhost *vhost;
  const struct lws_protocols *protocol;

  struct per_session_data__wind *pss_list; /* linked-list of live pss*/

  int filefd; /* Serial port file descriptor */
  char msg[MSGBUF]; /* current wind message (json string + websocket preamble) */
  int msglen;
};

static void init_history() {
  // Measure how big a history json message is
  struct timeval tv;
  gettimeofday(&tv, NULL);
  char tbuf[32];
  sprintf(tbuf, HIST_ENTRY_JSON, tv.tv_sec, 10.1, 15.1);
  int hist_entry_json_len = strlen(tbuf);
  hist_size = HIST_ENTRIES * hist_entry_json_len + 128; // 32 bytes of slop
  hist_buf = malloc(hist_size);

  lwsl_user("Initializing history sec %u", tv.tv_sec);
  int i;
  unsigned m = tv.tv_sec / 60;
  for (i = 0; i < HIST_ENTRIES; i++) {
    int idx = (tv.tv_sec - i) % HIST_ENTRIES;
    wind_hist[idx].ts = (m - i) * 60; // convert from minute to seconds
    wind_hist[idx].aws = 0.0;
    wind_hist[idx].gust = 0.0;
    wind_hist[idx].awa = 0.0;
  }
}

static void init_airmar(int fd) {
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

  if (tcsetattr(fd, TCSANOW, &tty) != 0) {
    lwsl_user("Error %i from tcsetattr: %s\n", errno, strerror(errno));
    return;
  }

  // Airmar is 4800 baud
  cfsetispeed(&tty, B4800);
  cfsetospeed(&tty, B4800);
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
  uint8_t buf[64];
  cJSON *json;

  switch (reason) {
  case LWS_CALLBACK_PROTOCOL_INIT:
    vhd = lws_protocol_vh_priv_zalloc(lws_get_vhost(wsi),
				      lws_get_protocol(wsi),
				      sizeof(struct per_vhost_data__wind));
    vhd->context = lws_get_context(wsi);
    vhd->protocol = lws_get_protocol(wsi);
    vhd->vhost = lws_get_vhost(wsi);

    // Should open the file in "cooked" mode to make sure we don't get per-character upcalls
    vhd->filefd = lws_open(nmeafn, O_RDONLY);
    if (vhd->filefd == -1) {
      lwsl_err("Unable to open %s\n", nmeafn);

      return 1;
    }

    init_airmar(vhd->filefd);
    
    u.filefd = (lws_filefd_type)(long long)vhd->filefd;
    if (!lws_adopt_descriptor_vhost(lws_get_vhost(wsi),
				    LWS_ADOPT_RAW_FILE_DESC, u, "wind", NULL)) {
      lwsl_err("Failed to adopt serial port file descriptor\n");
      close(vhd->filefd);
      vhd->filefd = -1;

      return 1;
    }
    break;

  case LWS_CALLBACK_PROTOCOL_DESTROY:
    if (vhd->filefd != -1)
      close(vhd->filefd);
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
    if (pss->needs_history) {
      //lwsl_user("Sending history");
      m = lws_write(wsi, &hist_buf[LWS_PRE], strlen(&hist_buf[LWS_PRE]), LWS_WRITE_TEXT);
      lws_callback_on_writable(pss->wsi); // Still need to send last wind reading
      pss->needs_history = 0;
      break;
    }
    
    //lwsl_user("Sending update %s\n", &vhd->msg[LWS_PRE]);
    m = lws_write(wsi, ((unsigned char *)&vhd->msg) + LWS_PRE, vhd->msglen, LWS_WRITE_TEXT);
    if (m < (int)vhd->msglen) {
      lwsl_err("ERROR %d writing to ws socket\n", m);
      return -1;
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

    const cJSON *wind = cJSON_GetObjectItemCaseSensitive(json, "subscribe_wind");
    const cJSON *history = cJSON_GetObjectItemCaseSensitive(json, "subscribe_history");

    if (wind != NULL) {
      if (cJSON_IsBool(wind)) {
	pss->subscribe_wind = (wind->valueint == 1);
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_wind %d\n", pss->subscribe_wind);
      }
    }

    if (history != NULL) {
      if (cJSON_IsBool(history)) {
	pss->subscribe_history = (history->valueint == 1);
	if (pss->subscribe_history) pss->needs_history = 1; // Send history immediately
	lwsl_notice("LWS_CALLBACK_RECEIVE subscribe_history %d\n", pss->subscribe_history);
      }
    }

    cJSON_Delete(json);
    break;

  case LWS_CALLBACK_RAW_ADOPT_FILE:
    lwsl_notice("LWS_CALLBACK_RAW_ADOPT_FILE\n");
    break;

  case LWS_CALLBACK_RAW_RX_FILE:
    /* Read and parse a text line from the weather station, tell clients there's data to send */
    lwsl_debug("LWS_CALLBACK_RAW_RX_FILE\n");
    n = (int)read(vhd->filefd, buf, sizeof(buf));
    if (n < 0) {
      lwsl_err("Reading from %s failed\n", nmeafn);

      return 1;
    }
    //lwsl_hexdump_level(LLL_NOTICE, buf, (unsigned int)n);
		
    struct timeval tv;
    gettimeofday(&tv, NULL);
    
    float awa, aws;
    char awa_ref, aws_unit;
    if (strncmp((const char *)&buf, "$WIMWV", sizeof("$WIMWV")-1)) {
      break;
    }
		
    int r = sscanf(buf, "$WIMWV,%f,%c,%f,%c,", &awa, &awa_ref, &aws, &aws_unit);
    if ((r != 4) || (awa_ref != 'R') || (aws_unit != 'N')) {
      break;
    }

    // Adjust reading for sensor not pointing north
    awa += SENSOR_OFFSET;
    awa = (awa < 360.0) ? awa : awa - 360.0;

    aws_buf[buf_idx] = aws;
    awa_buf[buf_idx] = awa;
    
    /* Determine average wind angle - what happens when wind is oscillating from dead ahead?
     * If some samples are slightly positive and others are 'negative' (close to 360) then
     * the average is close to 180! This is not zero, as it should be. So keep track of a total
     * of the angles + 180 degrees - more samples are 'north' use the biased total, otherwise
     * use the unbiased total.
     */
    float aws_avg = 0.0, gust = 0.0, awa_avg = 0.0, awa_bias = 0.0;
    int south_count = 0;
    for (int i = 0; i < RECENT_BUF; i++) {
      aws_avg += aws_buf[i];
      gust = (aws_buf[i] > gust) ? aws_buf[i] : gust;

      float s = awa_buf[i];
      awa_avg += s;
      awa_bias += (s + ((s < 180.0) ? 180.0 : -180.0));
      if ((s > 90.0) && (s <= 270.0)) south_count++;
    }
    aws_avg /= RECENT_BUF;

    if (south_count > (RECENT_BUF/2))
      awa_avg /= RECENT_BUF; /* More than half are south-ish */
    else {
      //lwsl_notice("south %d awa %.1f awa_bias %.2f / %d = avg %.0f", south_count, awa, awa_bias, RECENT_BUF, awa_bias/RECENT_BUF);
      awa_avg = (awa_bias / RECENT_BUF) - 180.0; /* More than half are north-ish */
      awa_avg = (awa_avg > 0.0) ? awa_avg : awa_avg + 360.0;
    }


    int new_history = 0;
    int this_minute = tv.tv_sec / 60;
    int index = (this_minute % HIST_ENTRIES);
    if (this_minute != hist_last_minute) {
      if (!(this_minute % HIST_FREQUENCY)) {
	char entry[64];
	// Create history JSON buffer
	strcpy(&hist_buf[LWS_PRE], "{ \"event\": \"history\", \"history\": [");
	for (int i = 0; i < HIST_ENTRIES; i++) { // BARF - this is n^2 in HIST_ENTRIES
	  int h = (this_minute + i) % HIST_ENTRIES;
	  sprintf(entry, HIST_ENTRY_JSON, wind_hist[h].ts, wind_hist[h].aws, wind_hist[h].gust, wind_hist[h].awa);
	  strcat(hist_buf, entry);
	}
	hist_buf[strlen(hist_buf) - 1] = 0; // Chomp off the trailing comma
	strcat(hist_buf, "] }");
	//lwsl_user("HISTORY %d entries length %d", HIST_ENTRIES, strlen(&hist_buf[LWS_PRE]));
	//lwsl_user("%s", &hist_buf[LWS_PRE]);
	new_history = 1;
      }
      wind_hist[index].gust = 0;
      hist_last_minute = this_minute;
      //lwsl_user("new minute seconds %u index %d ", tv.tv_sec, index);
    }

    wind_hist[index].ts = this_minute * 60;
    wind_hist[index].aws = aws_avg;
    wind_hist[index].awa = awa_avg;
    if (gust > wind_hist[index].gust)
      wind_hist[index].gust = gust;

    memset(&vhd->msg[0], 0, sizeof(vhd->msg));
    sprintf(&vhd->msg[LWS_PRE], "{ \"event\": \"update\", \"aws_avg\": %4.1f, \"gust\": %4.1f, \"awa\": %5.1f, \"awa_avg\": %5.1f }", aws_avg, gust, awa, awa_avg);
    vhd->msglen = strlen(&vhd->msg[LWS_PRE]);
    // lwsl_notice("idx %3d %4.1f %s\n", aws, buf_idx, &vhd->msg[LWS_PRE]);
    buf_idx = (buf_idx + 1) % RECENT_BUF;

    /* we have new wind readings to write to each client */
    lws_start_foreach_llp(struct per_session_data__wind **,
			  ppss, vhd->pss_list) {
      if (new_history && (*ppss)->subscribe_history) (*ppss)->needs_history = 1;
      if ((*ppss)->needs_history || (*ppss)->subscribe_wind)
	lws_callback_on_writable((*ppss)->wsi);
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
  lwsl_user("LWS Serve up wind from a NMEA-0183 wind instrument\n");
  if (argc != 1) {
    lwsl_user("Usage: %s (will read data from %s)", argv[0], nmeafn);
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
