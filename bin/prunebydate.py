#!/usr/bin/python
import os
import re
import shutil
import argparse
import datetime
import logging

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("-days", default=8, type=int, help="Delete directories older than N days in format YYMMDD");
    parser.add_argument("-dir", nargs='+', help="Root of directories to be culled");
    parser.add_argument("-nodelete", action='store_true', help="Don't delete, just print what would be deleted");
    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="info", help="Log level")
    args = parser.parse_args()

    if args.log == "debug":
        loglevel = logging.DEBUG
    if args.log == "info":
        loglevel = logging.INFO
    if args.log == "warning":
        loglevel = logging.WARNING
    if args.log == "error":
        loglevel = logging.ERROR
    if args.log == "critical":
        loglevel = logging.CRITICAL

    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    logging.debug(args)

    for d in args.dir:
        logging.debug("dir %s" % (d))

    now = datetime.datetime.now()
    keeptime = now - datetime.timedelta(days = args.days)
    keepts = keeptime.strftime("%Y%m%d")

    datepat = re.compile(r'(\d{8})')

    for d in args.dir:
        entry = os.listdir(d)
        for e in entry:
            isdate = datepat.match(e)
            if isdate:
                if e < keepts:
                    logging.info("Deleting %s/%s" % (d, e))
                    if not args.nodelete:
                        shutil.rmtree("%s/%s" % (d, e))
                else:
                    logging.debug("Keeping %s/%s" % (d, e))
