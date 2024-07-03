#!/usr/bin/python

racedate = "2023-09-23"

import math
import os
#import time
import datetime
import pytz
import zoneinfo
import logging
import subprocess
import argparse

loglevel = logging.DEBUG

# Font kludges - assumes fixed width font
charHeight = 13
charWidth = 9
charBoxBorder = 2

markradius = 4

current_min = -5.0
current_max = 5.0

indent_spaces = '                                                                                                    '
indent_level = 0

def indent(f, l):
    f.write("%s%s\n" % (indent_spaces[0:indent_level*4], l))

# text is a terminal node
def element(t):
    return {"e": 'element', "t": t, "child": []}

def emitElement(f, e):
    indent(f, e["t"])

def text(t, cl, x, y, a):
    return {"e": 'text', "t": t, "cl": cl, "x":x, "y": y, "anchor": a, "child": []}

def emitText(f, e):
    anchor = ""
    if e["anchor"] != None:
        anchor = 'text-anchor="%s" ' % (e["anchor"])
    cl = ""
    if e["cl"] != None:
        cl = 'class="%s" ' % (e["cl"])
    indent(f, '<text %s%sx="%.5f" y="%.5f">%s</text>' % (cl, anchor, e["x"], e["y"], e["t"]))

def text2(t, cl, x, y, a, ex):
    return {"e": 'text2', "t": t, "cl": cl, "x":x, "y": y, "anchor": a, "extra": ex, "child": []}

def emitText2(f, e):
    anchor = ""
    if e["anchor"] != None:
        anchor = 'text-anchor="%s" ' % (e["anchor"])
    extra = ""
    if e["extra"] != None:
        extra = '%s ' % (e["extra"])
    cl = ""
    if e["cl"] != None:
        cl = 'class="%s" ' % (e["cl"])
    indent(f, '<text %s%s%sx="%.5f" y="%.5f">%s</text>' % (cl, extra, anchor, e["x"], e["y"], e["t"]))

def style():
    return { "e": 'style', "child": [] }

def emitStyle(f, e):
    global indent_level
    indent(f, '<style type="text/css">')
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, '</style>')

def cdata():
    return { "e": 'cdata', "child": [] }

def emitcdata(f, e):
    global indent_level
    indent(f, '	<![CDATA[>')
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, ']]>')

def clipPath():
    return {"e": 'clipPath', "width": args.width, "height": args.height, "child": []}

def emitClipPath(f, e):
    global indent_level
    indent(f, '<clipPath id="clipBox">')
    indent_level += 1
    indent(f, '<rect x="0" y="0" width="%.0f" height="%.0f"/>' % (args.width, args.height))
    indent_level -= 1
    indent(f, '</clipPath>')

def defs():
    return {"e": 'defs', "child": []}

def emitDefs(f, e):
    global indent_level
    indent(f, '<defs>')
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, '</defs>')
    
def circle(cl, x, y, r):
    return {'e': 'circle', "cl": cl, "x": x, "y": y, "r": r }

def emitCircle(f, e):
    cl = ""
    if e["cl"] != None:
        cl = 'class="%s" ' % (e["cl"])
    indent(f, '<circle %scx="%.5f" cy="%.5f" r="%.5f"/>' % (cl, e["x"], e["y"], e["r"]))

def g(t):
    return {"e": 'g', "t": t, "child": []}

def emitg(f, e):
    global indent_level
    if e["t"] != None:
        indent(f, '<g %s>' % (e["t"]))
    else:
        indent(f, '<g>')
        
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, '</g>')

def rect(cl, x, y, w, h):
    return {"e": 'rect', "x": x, "y": y, "width": w, "height": h, "cl": cl, "child": []}

def emitRect(f, e):
    indent(f, '<rect class="%s" x="%.5f" y="%.5f" width="%.5f" height="%.5f"/>' % (e["cl"], e["x"], e["y"], e["width"], e["height"]))

def line(cl, x1, y1, x2, y2):
    return {"e": 'line', "x1": x1, "y1": y1, "x2": x2, "y2": y2, "cl": cl, "child": []}
    
def emitLine(f, e):
    indent(f, '<line class="%s" x1="%.5f" y1="%.5f" x2="%.5f" y2="%.5f"/>' % (e["cl"], e["x1"], e["y1"], e["x2"], e["y2"]))

def polygon(cl, points):
    return {"e": 'polygon', "cl": cl, "points": points, "child": []}

def emitPolygon(f, e):
    indent(f, '<polygon class="%s" points="' % (e["cl"]))
    for p in e["points"]:
        f.write("%d %.5f " % (p[0], p[1]))
    f.write("\n")
    indent(f, '"/>')

def polyline(cl, points):
    return {"e": 'polyline', "cl": cl, "points": points, "child": []}

def emitPolyline(f, e):
    indent(f, '<polyline class="%s" points="' % (e["cl"]))
    for p in e["points"]:
        f.write("%.5f,%.5f " % (p[0], p[1]))
    f.write("\n")
    indent(f, '"/>')

def use(href, cl, w, h, x, y):
    return {"e": 'use', "href": href, "cl": cl, "width": w, "height": h, "x": x, "y": y}

def emitUse(f, e):
    w = ""
    if e["width"] != None:
        w = 'width="%s" ' % (e["width"])
    h = ""
    if e["height"] != None:
        h = 'height="%s" ' % (e["height"])
    indent(f, '<use href="%s" class="%s" %s%sx="%.5f" y="%.5f" />' % (e["href"], e["cl"], w, h, e["x"], e["y"]))

def symbol(id1, w, h, x1, y1, x2, y2):
    return {'e': 'symbol', "id": id1, "width": w, "height": h, "x1": x1, "y1": y1, "x2": x2, "y2": y2, "child": []}

def emitSymbol(f, e):
    global indent_level
    w = ""
    if e["width"] != None:
        w = 'width="%.0f" ' % (e["width"])
    h = ""
    if e["height"] != None:
         h = 'height="%.0f" ' % (e["height"])
    indent(f, '<symbol id="%s" %s%sviewBox="%.0f %.0f %.0f %.0f">' % (e["id"], w, h, e["x1"], e["y1"], e["x2"], e["y2"]))
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, '</symbol>')

def svg(w, h, x1, y1, x2, y2, t):
    return {"e": 'svg', "width": w, "height": h, "x1": x1, "y1": y1, "x2": x2, "y2": y2, "t": t, "child": []}

def emitSVG(f, e):
    global indent_level
    if e["width"] != None:
        indent(f, '<svg width="%.0f" height="%.0f" viewBox="%.0f %.0f %.0f %.0f" %s>' % (e["width"], e["height"], e["x1"], e["y1"], e["x2"], e["y2"], e["t"]))
    else:
        indent(f, '<svg viewBox="%.0f %.0f %.0f %.0f" %s>' % (e["x1"], e["y1"], e["x2"], e["y2"], e["t"]))
        
    indent_level += 1
    emit(f, e["child"])
    indent_level -= 1
    indent(f, '</svg>')

emit_map = {
    'element': emitElement,
    'svg': emitSVG,
    'cdata': emitcdata,
    'clipPath': emitClipPath,
    'style': emitStyle,
    'defs': emitDefs,
    'rect': emitRect,
    'line': emitLine,
    'circle': emitCircle,
    'polygon': emitPolygon,
    'polyline': emitPolyline,
    'g': emitg,
    'text': emitText,
    'text2': emitText2,
    'symbol': emitSymbol,
    'use': emitUse,
}

def emit(f, tree):
    for e in tree:
        emit_map[e["e"]](f, e)

def build_current_tree(current_info):

    def scaleX(x):
        return (x - begints) * xfactor

    def scaleY(y):
        return (y - current_max) * yfactor

    logging.debug("Currents for %s" % (current_info["current_info"]["location"]))
    first_point = current_info["current_points"][0]
    last_point = current_info["current_points"][-1]
    begints = first_point[0]
    endts = last_point[0]

    logging.debug("viewBox %d x %d" % (args.width, args.height))
    logging.debug("begints %d endts %d span %d" % (begints, endts, endts - begints))

    xfactor = float(args.width) / float(endts - begints)
    yfactor = float(args.height) / float(current_min - current_max)

    show_line = 0
    if args.show:
        show_line = 1
    y_top = scaleY(current_max) + ((2 + show_line) * (charHeight + 2 * charBoxBorder))
    y_height = scaleY(current_min) - (2 * (charHeight + 2 * charBoxBorder)) - y_top

    logging.debug("xfactor: %.5f yfactor: %.5f" % (xfactor, yfactor))
    
    tree = []
    tree.append(element('<?xml version="1.0" encoding="iso-8859-1" standalone="no"?>'))
    tree.append(element('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'))
    #outersvgTree = svg(args.width, args.height, 0, 0, args.width, args.height, 'xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid meet"')
    outersvgTree = svg(None, None, 0, 0, args.width, args.height, 'xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid meet"')
    tree.append(outersvgTree)
    defsTree = defs()
    outersvgTree["child"].append(defsTree)
    styleTree = style()
    defsTree["child"].append(styleTree)
    styleTree["child"].append(element('.bg {fill: white}'))
    styleTree["child"].append(element('.current {fill: none; stroke: #2F5C8F; stroke-width: 4}'))
    styleTree["child"].append(element('.time {stroke: #D85C27; stroke-dasharray: 2}'))
    styleTree["child"].append(element('.axis {stroke: #808080; stroke-dasharray: 2}'))
    styleTree["child"].append(element('.slack {stroke: black; fill: black;}'))
    styleTree["child"].append(element('.slackmark {fill: black;}'))
    styleTree["child"].append(element('.maxflood {fill: red; stroke: #D85C27}'))
    styleTree["child"].append(element('.maxfloodmark {fill: #D85C27}'))
    styleTree["child"].append(element('.maxebb {fill: red; stroke: #D85C27}'))
    styleTree["child"].append(element('.maxebbmark {fill: #D85C27}'))
    styleTree["child"].append(element('.frame {fill: none; stroke: black}'))
    styleTree["child"].append(element('.label {fill: black; stroke: black}'))
    styleTree["child"].append(element('.labelbg {fill: #c0c0c0; stroke: none; opacity: 0.50}'))
    styleTree["child"].append(element('.race {fill: lightblue; stroke: none; opacity: 0.50}'))
    #defsTree = defs()
    #outersvgTree["child"].append(defsTree)
    clipPathTree = clipPath()
    defsTree["child"].append(clipPathTree)

    currentMark = symbol("mark", None, None, 0, 0, markradius*2, markradius*2)
    currentMark["child"].append(circle(None, markradius, markradius, markradius))
    defsTree["child"].append(currentMark)
    
    innergTree = g('clip-path="url(#clipBox)" font-family="Liberation Mono, Courier New" font-size="16px"')
    outersvgTree["child"].append(innergTree)
    
    # Background rect
    innergTree["child"].append(rect("bg", scaleX(begints), scaleY(current_max), scaleX(endts), scaleY(current_min)))
    
    # X Axes (Current speed)
    c = math.floor(current_min + 1.0)
    while c < current_max:
        if c == 0:
            x1 =  scaleX(begints) + charHeight + (5*charWidth) + (4*charBoxBorder)
            innergTree["child"].append(line("slack", x1, scaleY(c), scaleX(endts), scaleY(c)))
        else:
            x1 =  scaleX(begints) + charHeight + (4*charBoxBorder)
            innergTree["child"].append(line("axis", x1, scaleY(c), scaleX(endts), scaleY(c)))
        c += 1

    # Y Axes - every 6 hours?
    begindt = datetime.datetime.fromtimestamp(begints)
    enddt = datetime.datetime.fromtimestamp(endts)
    now = begindt
    while now <= enddt:
        innergTree["child"].append(line("time", scaleX(now.timestamp()), y_top, scaleX(now.timestamp()), y_height+y_top))
        now += datetime.timedelta(hours = 6)
    
    # Active Race boxes
    begindt = datetime.datetime.fromtimestamp(begints)
    enddt = datetime.datetime.fromtimestamp(endts)

    today = begindt
    startoffset = datetime.datetime.strptime(args.raceStart, "%H:%M")
    startdelta = datetime.timedelta(hours=startoffset.hour, minutes=startoffset.minute)
    endoffset = datetime.datetime.strptime(args.raceEnd, "%H:%M")
    #enddelta = datetime.timedelta(hours=endoffset.hour, minutes=endoffset.minute)
    enddelta = endoffset - startoffset

    racewidth = (datetime.datetime.fromtimestamp(0) + enddelta).timestamp()
    logging.debug("racewidth %r" % (racewidth))
    while today < enddt:
        start = (today + startdelta).timestamp()
        logging.debug("start %r" % (start))
        innergTree["child"].append(rect("race", scaleX(start), y_top, racewidth * xfactor, y_height))
        today = today + datetime.timedelta(hours = 24)

    # Tide polyline
    points = []
    #points.append([scaleX(current_info["current_points"][0][0]), scaleY(0.0)])
    for p in current_info["current_points"]:
        points.append([scaleX(p[0]), scaleY(p[1])])
    #points.append([scaleX(current_info["current_points"][-1][0]), scaleY(0.0)])

    innergTree["child"].append(polyline("current", points))

    # Current Speed Labels
    s = "Current Speed (Knots)"
    y = scaleY(0)
    x = charHeight + charWidth
    borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
    #innergTree["child"].append(rect("labelbg",  charBoxBorder, y - (borderWidth / 2), charHeight+2*charBoxBorder, borderWidth))
    
    innergTree["child"].append(text2(s, "label", -scaleY(0), charHeight, "middle", 'transform="rotate(-90)"'))
    
    c = math.floor(current_min + 1.0)
    while c < current_max:
        if c == 0:
            s = "Slack"
        else:
            s = "%d" % (c)
        y = scaleY(c)
        x = charHeight + charWidth
        borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
        #innergTree["child"].append(rect("labelbg",  x - charBoxBorder, y - charHeight , borderWidth, charHeight+2*charBoxBorder))
        innergTree["child"].append(text(s, "label", x, y, None))
        c += 1

    # High / Slack / Low symbols
    for e in current_info["current_info"]["events"]:
        dt = datetime.datetime.strptime(e["t"], "%Y-%m-%d %H:%M")
        ts = dt.timestamp()
        estyle = ""
        if e["e"] == "Max Flood":
            estyle = "maxfloodmark"
            y = e["v"]
        if e["e"][:5] == "Slack":
            estyle = "slackmark"
            y = 0
        if e["e"] == "Max Ebb":
            estyle = "maxebbmark"
            y = e["v"]
        if estyle != "":
            borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
            innergTree["child"].append(use("#mark", estyle, 2*markradius, 2*markradius, scaleX(ts)-markradius, scaleY(y)-markradius))

    # Time Labels
    begindt = datetime.datetime.fromtimestamp(begints)
    enddt = datetime.datetime.fromtimestamp(endts)
    dt = begindt
    dt += datetime.timedelta(hours = 6) # Skip first midnight for current speed label
    while dt <= enddt:
        ts = dt.timestamp()
        if dt.hour == 0:
            s = "Midnight"
        elif dt.hour == 12:
            s = "Noon"
        else:
            s = dt.strftime("%H:%M")
        y = ((1 + show_line) * (charHeight + charBoxBorder)) + charHeight
        borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
        #innergTree["child"].append(rect("labelbg", scaleX(ts) - (borderWidth/2), y - charHeight , borderWidth, charHeight+2*charBoxBorder))
        innergTree["child"].append(text(s, "label", scaleX(ts), y, "middle"))
        if dt.hour == 12:
            s = dt.strftime("%a, %b %d %Y")
            y = ((0 + show_line) * (charHeight + charBoxBorder)) + charHeight
            borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
            #innergTree["child"].append(rect("labelbg", scaleX(ts) - (borderWidth/2), y - charHeight , borderWidth, charHeight+2*charBoxBorder))
            innergTree["child"].append(text(s, "label", scaleX(ts), y, "middle"))
        dt += datetime.timedelta(hours = 6)

    innergTree["child"].append(rect("frame", scaleX(begints), scaleY(current_max), scaleX(endts), scaleY(current_min)))

    # Current event labels (max, min, slack)
    for e in current_info["current_info"]["events"]:
        dt = datetime.datetime.strptime(e["t"], "%Y-%m-%d %H:%M")
        ts = dt.timestamp()
        s = ""
        cl = ""
        if e["e"] == "Max Flood":
            s = "%s %.1f" % (dt.strftime("%H:%M"), e["v"])
            cl = "maxflood"
            # Label on bottom
            # y = args.height - ((2 * (charHeight + charBoxBorder)) + (charHeight/2))

            # Label on top (under time of day)
            y = scaleY(e["v"]) - charHeight
            miny = ((2 + show_line) * (charHeight + charBoxBorder)) + charHeight
            if (y < miny):
                y = miny
        if e["e"][:5] == "Slack":
            cl = "slack"
            s = "%s" % (dt.strftime("%H:%M"))
            y = args.height - ((0 * (charHeight + charBoxBorder)) + (charHeight/2))
        if e["e"] == "Max Ebb":
            cl = "maxebb"
            s = "%s %.1f" % (dt.strftime("%H:%M"), e["v"])
            maxy = args.height - ((1 * (charHeight + charBoxBorder)) + (charHeight/2))
            y = scaleY(e["v"]) + (charHeight + 2*charBoxBorder)
            if (y > maxy):
                y = maxy
        if s != "":
            borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
            innergTree["child"].append(rect("labelbg", scaleX(ts) - (borderWidth/2), y - charHeight , borderWidth, charHeight+2*charBoxBorder))
            innergTree["child"].append(text(s, cl, scaleX(ts), y, "middle"))

    # Location Label
    if (args.show):
        locstring = ""
        for loc in tidelocations:
            if loc["NOAA_string"] == args.location:
                locstring = "(%s) " % (loc["arg"])
        s = "%s%s" % (locstring, current_info["current_info"]["location"])
        y = (0 * (charHeight + charBoxBorder)) + charHeight
        x = charWidth
        borderWidth = (len(s) * charWidth) + (2*charBoxBorder)
        #innergTree["child"].append(rect("labelbg",  x - charBoxBorder, y - charHeight , borderWidth, charHeight+2*charBoxBorder, 0))
        innergTree["child"].append(text(s, "label", x, y, None))
    
    return tree

tidelocations = [
    { "arg": "blackaller", "location": "Blackaller", "NOAA_string": "Fort Point, 0.5 nmi" },
    { "arg": "mason", "location": "Fort Mason", "NOAA_string": "Alcatraz Island, southwest of" },
    { "arg": "shag", "location": "Shag Rock", "NOAA_string": "Point Cavallo" },
    { "arg": "alcatraz", "location": "Little Alcatraz", "NOAA_string": "Alcatraz Island, 0.2 mi west of" },
    { "arg": "pier39", "location": "Pier 39 / Blossom", "NOAA_string": "North Point, Pier 35" },
    { "arg": "circle", "location": "Berkeley Circle", "NOAA_string": "Fleming Point" },
    { "arg": "southampton", "location": "Southampton Shoal", "NOAA_string": "Southampton Shoal" },
    { "arg": "stuart", "location": "Pt Stuart", "NOAA_string": "Raccoon Strait, off" },
    { "arg": "raccoon", "location": "mid-Racoon Strait", "NOAA_string": "Raccoon Strait" },
    { "arg": "gg", "location": "GG Bridge", "NOAA_string": "Golden Gate Bridge" },
    { "arg": "diablo", "location": "Pt Diablo, mid-channel", "NOAA_string": "San Francisco Bay" },
    { "arg": "mile", "location": "Mile Rock", "NOAA_string": "Mile Rock" },
    ]

args = None
if __name__ == '__main__':

    loglevel = logging.DEBUG
    parser = argparse.ArgumentParser()

    parser.add_argument("-date", default="today", help="Start Date")
    parser.add_argument("-days", type=int, default=2, help="# of days to graph")
    parser.add_argument("-width", type=int, default=800, help="Width")
    parser.add_argument("-height", type=int, default=450, help="Height")
    parser.add_argument("-raceStart", default="11:00", help="Race start time")
    parser.add_argument("-raceEnd", default="16:00", help="Race end time")
    parser.add_argument("-output", default="current.svg", help="Output file")
    parser.add_argument("-location", default="Point Cavallo", help="Location (xtide string)")
    #parser.add_argument("-nolabel", action=argparse.BooleanOptionalAction, dest=show, default=True, , help="Show the location string")
    parser.add_argument("-nolabel", action="store_false", dest="show", default=True, help="Show the location string")
    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="debug", help="Log level")
    for loc in tidelocations:
        parser.add_argument("-%s" % (loc["arg"]), dest="location", action="store_const", const=loc["NOAA_string"], help=loc["location"]);
        
    args = parser.parse_args()

    logmap = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL,
    }
    loglevel = logmap[args.log]
    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)

    logging.debug("Args: %r" % args)

    localtz = "America/Los_Angeles"
    local = pytz.timezone(localtz)
    
    if (args.date == "today"):
        now = datetime.datetime.now(tz=local)
        # clamp to midnight this morning
        start = datetime.datetime(year=now.year, month=now.month, day=now.day, hour=0, minute=0)
    else:
        start = datetime.datetime.fromisoformat("%sT00:00:00-08:00" % (args.date))
        
    begin_date = start.strftime("%Y-%m-%d %H:%M")
    end = start + datetime.timedelta(days = args.days)
    end_date = end.strftime("%Y-%m-%d %H:%M")

    # Currents (Station ID SFB1203_18, but xtide doesn't use Station IDs)
    # tide -l "Golden Gate Bridge, 0.46 nmi E of (depth 30 ft), California Current" -in y -b "2022-07-05 00:00" -e "2022-07-07 00:00"
    # tide -l "Golden Gate Bridge, 0.46 nmi E of (depth 30 ft), California Current" -in y -b "2022-07-05 00:00" -e "2022-07-07 00:00" -m r

    cmd = 'export HFILE_PATH=/usr/local/share/xtide; tide -l "LOCATION" -in y -b "BEGIN" -e "END" -m r -s 00:06'
    cmd = cmd.replace("LOCATION", args.location)
    cmd = cmd.replace("BEGIN", begin_date)
    cmd = cmd.replace("END", end_date)
    logging.debug("tide command: %s " % (cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))

    logging.debug("tide returned %r" % (result))
    current_list = result.stdout.split("\n")
    current_points = []
    logging.debug("current_list %r" % (current_list))

    #local = pytz.timezone(localtz)
    for i in current_list:
        #logging.debug("point %r" % (i))
        if i != '':
            if (True):
                (t, v) = i.split(" ");
                current_points.append([int(t), float(v)])
                
            if (False):
                (t, v) = i.split(" ");
                naive = datetime.datetime.fromtimestamp(int(t))
                local_dt = local.localize(naive)
                utc_dt = local_dt.astimezone(pytz.utc)
                val = float(v)
                current_points.append([naive.strftime("%Y-%m-%dT%H:%M"), val])
            if (False):
                (t, v) = i.split(" ");
                naive = datetime.datetime.fromtimestamp(int(t))
                local_dt = local.localize(naive)
                utc_dt = local_dt.astimezone(pytz.utc)
                val = float(v)
                current_points.append([utc_dt.strftime("%Y-%m-%dT%H:%M"), val])
                
    logging.debug("Points %r" % (current_points))
    
    cmd = 'export HFILE_PATH=/usr/local/share/xtide; tide -l "LOCATION" -b "BEGIN" -e "END" -in y -df "%Y-%m-%d" -tf "%H:%M"'
    cmd = cmd.replace("LOCATION", args.location)
    cmd = cmd.replace("BEGIN", begin_date)
    cmd = cmd.replace("END", end_date)
    logging.debug("tide command: %s " % (cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))

    logging.debug("Current info %r" % (result.stdout))

    info_list = result.stdout.split("\n")
    current_info = {}
    current_info["events"] = []
    for i in range(len(info_list)):
        l = info_list[i];
        if (len(l) == 0):
            pass;
        elif (i == 0):
            current_info["location"] = l;
        elif (i == 1):
            current_info["position"] = l;
        elif (i == 2):
            current_info["flood_direction"] = l;
        elif (i == 3):
            current_info["ebb_direction"] = l;
        elif (i == 4):
            pass
        else:
            logging.debug("line: %r" % (l))
            t = l[0:16]
            c = l[19:20]
            if (c >= "0") and (c <= "9"):
                v = float(l[17:24])
                e = l[31:]
                current_info["events"].append({"t": t, "v": v, "e": e})
            else:
                e = l[19:]
                current_info["events"].append({"t": t, "e": e})
    logging.debug("Events: %r" % (current_info))

    """
    logging.debug("Fetch: %s" % (url))
    res = urltryhard(url)
    if res == None:
        logging.warning("URL fetch failed");
        exit()
    logging.debug("Speeds csv %r", res)
    speeds = parse(res)
    """
    
    data = {}
    if len(current_points) != 0:
        data["current_points"] = current_points
    
    if len(current_info) != 0:
        data["current_info"] = current_info
    
    tree = build_current_tree(data)
    logging.debug("output in %s" % (args.output))
    with open(args.output, "w") as f:
        emit(f, tree)
