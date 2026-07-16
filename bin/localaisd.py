#!/usr/bin/python

import socket
import json
import time
import logging
import asyncio
import websockets

config = {
    "aishub_id": "AH_3579_83F88344",
    "debug": logging.INFO,
    "AISserverIP": "127.0.0.1",
    "AISserverPORT": 5006,
    "websocketIP": "127.0.0.1",
    "websocketPORT": 8185
}

logger = logging.getLogger(__name__)
FORMAT = '%(asctime)s %(message)s'
logging.basicConfig(level=config["debug"])

AIVDM_fields = ["callsign", "country", "country_code", "rxtime", "lat", "lon", "speed", "course", "heading", "turn", "accuracy", "shipname" ]

class Vessel:
    """Vessels seen by the AIS receiver"""
    mmsi = 0
    shipname = ""
    lat = 0.0
    lon = 0.0
    speed = 0.0
    course = 0.0
    heading = 0
    fields = {}
    first = time.time()

    def __init__(self, mmsi):
        self.mmsi = mmsi
        for f in AIVDM_fields:
            self.fields[f] = ""
        
    def update(self, j):
        self.last = time.time()
        for f in j:
            if f == "lat":
                self.lat = float(j["lat"])
            if f == "lon":
                self.lon = float(j["lon"])
            if f == "speed":
                self.speed = float(j["speed"])
            if f == "course":
                self.course = float(j["course"])
            if f == "heading":
                self.heading = int(j["heading"])
            if f == "shipname":
                self.shipname = j["shipname"]
            if f == "shiptype":
                self.shiptype = int(j["shiptype"])
            if f == "shiptype_text":
                self.shiptypeText = j["shiptype_text"]
            if f == "destination":
                #logger.info("ais: %9d '%s' destination '%s'" % (self.mmsi, self.shipname, j["destination"]))
                self.destination = j["destination"]
            if f == "to_bow":
                self.toBow = int(j["to_bow"])
            if f == "to_stern":
                self.toStern = int(j["to_stern"])
            if f == "to_port":
                self.toPort = int(j["to_port"])
            if f == "to_starboard":
                self.toStarboard = int(j["to_starboard"])
            if f == "aid_type":
                self.aidType = int(j["aid_type"])
                #logger.info("ais: %9d Setting AtoN type %d" % (self.mmsi, self.aidType))
            if f == "name":
                self.shipname = j["name"]
                #logger.info("ais: %9d Setting AtoN name %s" % (self.mmsi, self.shipname))
                
# Vessels indexed by MMSI
vessels = {}

class AISClientProtocol:
    def __init__(self, on_con_lost):
        self.on_con_lost = on_con_lost
        self.transport = None

    def connection_made(self, transport):
        logger.info('Connection made')
        self.transport = transport

    async def datagram_received(self, data, addr):
        await AISprocess(data)

    def error_received(self, exc):
        logger.info('Error received:', exc)

    def connection_lost(self, exc):
        logger.info("Connection closed")
        self.on_con_lost.set_result(True)

reapperiod = 60 * 60  # check once per hour
reaploiter = 7 * 24 * 60 * 60 # delete when not seen for a week
lastreap = time.time()

def reap():
    #
    global lastreap
    now = time.time()
    if now - lastreap > reapperiod:
        logger.debug("Reap")
        keys = vessels.keys()
        toBeReaped = []
        for mmsi in keys:
            v = vessels[mmsi]
            if now - v.last > reaploiter:
                toBeReaped.append(mmsi)
        for mmsi in toBeReaped:
                v = vessels[mmsi]
                #logger.info("Reaping %9d '%s'" % (v.mmsi, v.shipname))
                del(vessels[mmsi])
                del v
        lastreap = now

def createAISmsg(v):
    msg = {
        "mmsi": v.mmsi,
        "lat": v.lat,
        "lon": v.lon,
        "heading": v.heading,
        "course": v.course,
        "speed": v.speed,
        "shipname": v.shipname
    }
    if hasattr(v, 'shiptype'):
        msg["shiptype"] = v.shiptype
    if hasattr(v, 'shiptypeText'):
        msg["shiptypeText"] = v.shiptypeText
    if hasattr(v, 'destination'):
        msg["destination"] = v.destination
    if hasattr(v, 'toBow'):
        msg["toBow"] = v.toBow
    if hasattr(v, 'toStern'):
        msg["toStern"] = v.toStern
    if hasattr(v, 'toPort'):
        msg["toPort"] = v.toPort
    if hasattr(v, 'toStarboard'):
        msg["toStarboard"] = v.toStarboard
    if hasattr(v, 'aidType'):
        msg["aidType"] = v.aidType
                
    #jmsg = json.dumps(msg, separators=(',', ':'))
    jmsg = json.dumps(msg)
    return(jmsg)

async def AISprocess(data):
    rawdata = data.decode("utf-8") 

    if "}" in rawdata:
        rawdata=rawdata.replace('"nmea":"_','"nmea":["' )
        rawdata=rawdata.replace('"nmea":_"','"nmea":["' )

        s = json.loads(rawdata)
        
        mmsi = int(s["mmsi"])
            
        if not mmsi in vessels:
            logger.debug("New: %r" % (mmsi))
            vessels[mmsi] = Vessel(mmsi)

        v = vessels[mmsi]
        v.update(s)

        #logger.info("MMSI %9d '%r'" % (mmsi, s))
        #if mmsi > 10000000:
        
        logger.debug("MMSI %9s %9.4f %9.4f hdg %3d course %5.1f speed %4.1f '%s' " % (v.mmsi, v.lat, v.lon, v.heading, v.course, v.speed, v.shipname))
        msg = createAISmsg(v)

        cons = wsconnections
        for c in cons:
            try:
                await c.send(msg)
            except websockets.ConnectionClosed:
                logger.info("wshandler closed while sending %r" % (c))
                try:
                    wsconnections.remove(c);
                except:
                    logger.info("wshandler exception removing %r" % (c))
                

async def AISclient():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((config["AISserverIP"], config["AISserverPORT"]))
    sock.setblocking(False)

    loop = asyncio.get_event_loop()
    while True:
        try:
            data, addr = await loop.sock_recvfrom(sock, 1024)
            await AISprocess(data)
            reap()
        except BlockingIOError:
            logger.debug(f"AISclient No data available yet")
        
wsconnections = set()

shipCacheTime = 15*60 # 15 minutes

async def sendCachedVessels(ws):
    now = time.time()
    keys = vessels.keys()
    for mmsi in keys:
        # weird race condition if v is reaped while we're sending cached data
        if not (mmsi in vessels):
            continue
        v = vessels[mmsi]
        logger.debug("sendCachedVessels v %r keys %r" % (v, keys))
        if (now - v.last < shipCacheTime) or hasattr(v, "aidType"):
            msg = createAISmsg(v)
            try:
                await ws.send(msg)
            except websockets.ConnectionClosed:
                logger.info("sendCachedVessels connection closed %r" % (ws))
                return False
    return True

async def wshandler(ws):
    wsconnections.add(ws)
    logger.debug("wshandler new connection %r" % (ws))

    if not await sendCachedVessels(ws):
        logger.info("wshandler closed while sending cache %r" % (ws))
        wsconnections.remove(ws)
        return
    
    while True:
        try:
            # do a recv which will fail (via an exception) if the connection closes
            message = await ws.recv()
            # discard any data sent
            logger.info(f"wshandler %r received '{message}'" % (ws))
        except websockets.ConnectionClosed:
            logger.info("wshandler closed %r" % (ws))
            try:
                wsconnections.remove(ws)
            except:
                logger.info("wshandler remove exception %r" % (ws))
            break

def main():
    loop = asyncio.get_event_loop()

    logger.info("Listening for websocket requests on %r:%r" % (config["websocketIP"], config["websocketPORT"]))
    wsserver = websockets.serve(wshandler, config["websocketIP"], config["websocketPORT"])
    loop.run_until_complete(wsserver)

    logger.info("Listening for AIS on %r:%r" % (config["AISserverIP"], config["AISserverPORT"]))
    loop.create_task(AISclient())
    loop.run_forever()
    
if __name__ == '__main__':
    main()
