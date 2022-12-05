#!/usr/bin/python
# -*- coding: utf-8 -*-

# utf-8 allows printing degree symbol directly

#import json
#import csv
import re
import logging
import math
from math import radians, degrees, cos, sin, tan, atan2, log, sqrt, modf, pi
#import time
import os.path
import os
import datetime
import dateutil
import zoneinfo
import argparse
from osgeo import gdal
from osgeo import gdal_array
from osgeo import osr
import pyproj
import matplotlib
from matplotlib import pyplot as plt
import gpxpy
import numpy as np
import io
# Can't do grib overlays until imports are fixed somehow.
#import pygrib
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

tau = math.pi * 2

datastore_prefix = "/home/stfyc/www/html/data"
logo_prefix = "%s/%s" % (datastore_prefix, "logos")
output_prefix = "/overlay"

HD = (1280, 720);
FullHD = (1920, 1080);

regions = {}

# For timezone encoding see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

regions["BayDelta"] = {
    "arg": "baydelta",
    "title": "SF Bay/Delta",
    "tz": "America/Los_Angeles",
#    "start": "2020-08-25T18:00:00 +0000",
    "start": "2022-05-29T06:00:00 -0700",
    "end": "2100-12-21T23:00:00 +0000",
#    "area": (-125.20, 36.00, -118.50, 39.00), # lat/long of ll, ur (up to Monterey)
    "area": (-125.67, 36.27, -120.00, 39.00), # lat/long of ll, ur
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "model": "HRRR",
    "gribroot": "NOAA/HRRR/karl",
    "srs": "anti_mercator",
    "wind": "none",
    "barbreduce": 2,
    "barblen": 4.0,
    "alpha": 30.0,
    "size": FullHD,
    #"lonlat": "auto",
    "POIs": [
        ((-123.7360, 38.9530), "Pt Arena"),
        ((-123.0239, 37.9951), "Pt Reyes"),
        ((-122.7125, 38.4382), "Santa Rosa"),
        #((-122.4535, 37.8083), "Anita Rk"),
        ((-122.4466, 37.8073), "StFYC", "red"),
        #((-122.3855, 37.7817), "Pier 40"),
        #((-122.4935, 37.7247), "Harding Pk"),
        #((-122.5056, 37.7351), "Zoo"),
        #((-122.3914, 37.9036), "Richmond"),
        ((-122.4545, 38.1608), "Sears Pt"),
        #((-122.4333, 37.9632), "E Brother"),
        #((-122.2257, 38.0606), "Carquinez Br"),
        ((-122.1232, 38.0405), "Benicia Br"),
        #((-122.2578, 37.8720), "Campanile"),
        #((-122.3306, 37.7971), "Estuary"),
        ((-122.4994, 37.4923), "Mavericks"),
        ((-122.3862, 37.6163), "SFO"),
        #((-122.2133, 37.7124), "OAK"),
        #((-122.4273, 37.5288), "Montera Mt"),
        ((-122.1058, 38.3995), "Mt Vaca"),
        #((-122.5963, 37.9235), "Mt Tam"),
        ((-121.9141, 37.8815), "Mt Diablo"),
        ((-121.6427, 37.3419), "Mt Hamilton"),
        ((-123.0016, 37.6989), "SE Farallon"),
        #((-122.4830, 37.5026), "Pillar Pt"),
        #((-121.2932, 37.9548), "Stockton"),
        ((-121.4941, 38.0370), "Tinsley", "red"),
        ((-121.4936, 38.5766), "Sacramento"),
        ((-120.9973, 37.2537), "Gustine"),
        ((-120.4863, 37.3025), "Merced"),
        ((-119.7893, 36.7362), "Fresno"),
        ((-121.5686, 37.0068), "Gilroy"),
        ((-121.3272, 36.4289), "Soledad"),
        ((-122.0019, 36.9606), "Santa Cruz"),
        ((-121.9345, 36.6376), "Pt Pinos"),
        #((-121.9521, 38.3732), "Vacaville"),
        #((-119.7605, 39.0105), "North Sails Minden"),
    ],
}

regions["WestCoast"] = {
    "arg": "westcoast",
    "title": "West Coast Offshore",
    "tz": "America/Los_Angeles",
#    "start": "2020-08-25T18:00:00 +0000",
    "start": "2022-05-29T06:00:00 -0700",
    "end": "2100-12-21T23:00:00 +0000",
    "area": (-152.0, 30.0, -110.0, 50.0), # lat/long of ll, ur corner
    #"area": (-125.20, 36.00, -118.50, 39.00), # lat/long of ll, ur
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "srs": "anti_mercator",
    "wind": "none",
    "size": FullHD,
    "POIs": [
    ],
}

regions["PacCup"] = {
    "arg": "paccup",
    "tz": "PDT",
    "start": "2020-07-02T18:00:00 +0000",
    "end": "2020-07-12T23:04:00 +0000",
    "area": (-161.00, 19.00, -117.00, 40.00), # lat/long of ll, ur of image
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_GOES-West",
    "res": "2k",
    "sector": "FD",
    #"satroot": "GOES/NESDIS_CONUS-West",
    #"res": "1k",
    #"sector": "CONUS",
    "model": "GFS",
    "gribroot": "NOAA/GFS/paccup",
    "srs": "anti_mercator",
    "wind": "barbs",
    "barbreduce": 5,
    "barblen": 5.0,
    "alpha": 40.0,
    "surface": "Pacific",
    "size": (1280, 720),
    "gpxfn": "2020-07-12T1600_fogmachine.gpx",
    "title": "fogmachine - Virtual Pacific Cup",
    "POIs": [
        ((-122.4797, 37.8182), "Golden Gate"),
        ((-120.4532, 34.4424), "Pt Conception"),
        ((-157.7643, 21.4621), "Kaneohe"),
    ],
}

regions["Pacific"] = {
    "arg": "pacific",
    "tz": "UTC",
    "start": "2022-06-03T00:00:00 +0000",
    "end": "2050-01-01T00:00:00 +0000",
#    "area": (-205.0, 16.0, -115.0, 55.0), # lat/long of ur, ll corner of Surface Analysis
    "area": (-200.0, 16.0, -115.0, 55.0), # lat/long of ur, ll corner of Surface Analysis
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_GOES-West",
    "res": "2k",
    "sector": "FD",
    "surface": "Pacific",
    "srs": "anti_mercator",
    "wind": "none",
    "size": FullHD,
    #"logos": [{"fn": "rammb_logo.png"}, {"fn": "cira18Logo.png"}, {"fn": "GOES-S-Mission-Logo-1024x655.png"}, {"fn": "NOAA_logo.png"}, {"fn": "NWS_logo.png"}],
    #"logos": [{"fn": "rammb_logo.png"}, {"fn": "NOAA_logo.png"}, {"fn": "NWS_logo.png"}],
    #"logopos": "left",
}

regions["SFBay"] = {
    "arg": "sfbay",
    "tz": "PDT",
    "start": "2020-07-31T00:00:00 +0000",
    "end": "2021-08-01T00:00:00 +0000",
    "area": (-123.129, 37.60, -121.860, 38.159), # lat/long of ll, ur (up to Monterey)
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "model": "HRRR",
    "gribroot": "NOAA/HRRR/karl",
    "srs": "anti_mercator",
    "wind": "barbs",
    "barbreduce": 1,
    "barblen": 6.0,
    "alpha": 60.0,
    "size": (1280, 720),
    "POIs": [
        ((-123.7360, 38.9530), "Pt Arena"),
        ((-123.0239, 37.9951), "Pt Reyes"),
        ((-122.4535, 37.8083), "Anita Rk"),
        ((-122.3855, 37.7817), "Pier 40"),
        ((-122.4935, 37.7247), "Harding Pk"),
        ((-122.3914, 37.9036), "Richmond"),
        ((-122.4545, 38.1608), "Sears Pt"),
        ((-122.4333, 37.9632), "E Brother"),
        ((-122.2257, 38.0606), "Carquinez Br"),
        ((-122.1232, 38.0405), "Benicia Br"),
        ((-122.2578, 37.8720), "Campanile"),
        ((-122.3306, 37.7971), "Estuary"),
        ((-122.3862, 37.6163), "SFO"),
        ((-122.2133, 37.7124), "OAK"),
        ((-122.4273, 37.5288), "Montera Mt"),
        ((-122.1058, 38.3995), "Mt Vaca"),
        ((-122.5963, 37.9235), "Mt Tam"),
        ((-121.9141, 37.8815), "Mt Diablo"),
        ((-121.6427, 37.3419), "Mt Hamilton"),
        ((-123.0016, 37.6989), "SE Farallon"),
        ((-122.4830, 37.5026), "Pillar Pt"),
        ((-122.0019, 36.9606), "Santa Cruz"),
        ((-121.9345, 36.6376), "Pt Pinos"),
        #((-121.9521, 38.3732), "Vacaville"),
        ],
    "title": "SF Fog",
}

regions["Karl"] = {
    "arg": "karl",
    "tz": "PDT",
    "start": "2020-09-01T00:00:00 +0000",
    "end": "2021-10-01T00:00:00 +0000",
    "area": (-124.50, 36.75, -120.00, 38.75), # lat/long of ll, ur (up to Monterey)
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "model": "HRRR",
    "gribroot": "NOAA/HRRR/karl",
    "srs": "anti_mercator",
    "wind": "barbs",
    "barbreduce": 1,
    "barblen": 4.0,
    "alpha": 60.0,
    "size": (1280, 720),
    "POIs": [
        ((-123.7360, 38.9530), "Pt Arena"),
        ((-123.0239, 37.9951), "Pt Reyes"),
        ((-122.7125, 38.4382), "Santa Rosa"),
        ((-122.4535, 37.8083), "Anita Rk"),
        #((-122.3855, 37.7817), "Pier 40"),
        #((-122.4935, 37.7247), "Harding Pk"),
        ((-122.5056, 37.7351), "Zoo"),
        ((-122.3914, 37.9036), "Richmond"),
        ((-122.4545, 38.1608), "Sears Pt"),
        ((-122.4333, 37.9632), "E Brother"),
        #((-122.2257, 38.0606), "Carquinez Br"),
        ((-122.1232, 38.0405), "Benicia Br"),
        ((-122.2578, 37.8720), "Campanile"),
        #((-122.3306, 37.7971), "Estuary"),
        ((-122.3862, 37.6163), "SFO"),
        ((-122.2133, 37.7124), "OAK"),
        ((-122.4273, 37.5288), "Montera Mt"),
        ((-122.1058, 38.3995), "Mt Vaca"),
        ((-122.5963, 37.9235), "Mt Tam"),
        ((-121.9141, 37.8815), "Mt Diablo"),
        ((-121.6427, 37.3419), "Mt Hamilton"),
        ((-123.0016, 37.6989), "SE Farallon"),
        #((-122.4830, 37.5026), "Pillar Pt"),
        ((-121.2932, 37.9548), "Stockton"),
        ((-121.4936, 38.5766), "Sacramento"),
        ((-120.4863, 37.3025), "Merced"),
        ((-119.7893, 36.7362), "Fresno"),
        ((-121.5686, 37.0068), "Gilroy"),
        ((-122.0019, 36.9606), "Santa Cruz"),
        ((-121.9345, 36.6376), "Pt Pinos"),
        #((-121.9521, 38.3732), "Vacaville"),
        ],
    "title": "Karl the Fog",
}

FirePOIs = [
#    ((-121.0147, 39.05), "River", "red"),
    ((-121.2500, 40.01), "Dixie", "red"),
    ((-120.9600, 40.01), "Fly", "red"),
#    ((-119.8000, 38.70), "Tamarack", "red"),
    ((-123.0300, 40.36), "McFarland", "red"),
    ((-123.2900, 40.75), "Monument", "red"),
    ((-123.0180, 41.143), "River Complex", "red"),
    ((-121.9190, 41.521), "Antelope", "red"),
    ((-123.4040, 41.564), "McCash", "red"),
    ((-121.0300, 42.62), "Bootleg", "red"),
    ((-123.0800, 42.89), "Skyline Ridge", "red"),
    ((-120.5330, 38.5830), "Caldor", "red"),
    ((-122.6200, 43.27), "Jack", "red"),
]

FirePOIs_2020 = [
        ((-123.2700, 41.8610), "Slater", "red"),
        ((-123.2700, 41.1145), "Red Salmon", "red"),
        ((-122.6709, 41.2687), "Fox", "red"),
        ((-122.4951, 40.4978), "Zogg", "red"),
        #((-122.4700, 39.8218), "August", "red"),
        ((-122.6239, 40.1033), "August", "red"),
        #((-119.8801, 41.0752), "Cold Springs", "red"),
        ((-120.6800, 39.9055), "Claremont/Bear", "red"),
        ((-122.4439, 38.5823), "Glass", "red"),
        #((-121.4182, 36.1645), "Dolan", "red"),
        #((-120.3810, 38.9610), "Fork", "red"),
        #((-119.4406, 38.5782), "Slink", "red"),
        ((-119.5827, 37.8662), "Bluejay/Wolf", "red"),
        ((-119.2000, 37.1942), "Creek", "red"),
        #((-118.5200, 36.7255), "Moraine", "red"),
        ((-118.2376, 36.2000), "Castle", "red"),
        ((-116.8451, 34.0710), "El Dorado", "red"),
        ((-117.8991, 34.2425), "Bobcat", "red"),
        #((-116.6740, 32.7640), "Valley", "red"),
    ]


#regions["BayDelta"]["POIs"].extend(FirePOIs)

# Lines for calibration
"""
    "lines": [
        # longitude
        ((-120, 36), (-120, 39)),
        ((-121, 36), (-121, 39)),
        ((-122, 36), (-122, 39)),
        ((-123, 36), (-123, 39)),
        ((-124, 36), (-124, 39)),
        # latitude
        ((-124, 36), (-120, 36)),
        ((-124, 36.1), (-120, 36.1)),
        ((-124, 36.2), (-120, 36.2)),
        ((-124, 36.3), (-120, 36.3)),
        ((-124, 36.4), (-120, 36.4)),
        ((-124, 36.5), (-120, 36.5)),
        ((-124, 37), (-120, 37)),
        ((-124, 38), (-120, 38)),
        ((-124, 38.5), (-120, 38.5)),
        ((-124, 38.6), (-120, 38.6)),
        ((-124, 38.7), (-120, 38.7)),
        ((-124, 38.8), (-120, 38.8)),
        ((-124, 38.9), (-120, 38.9)),
        ((-124, 39), (-120, 39)),
    ],
"""

regions["Eddy"] = {
    "arg": "eddy",
    "start": "2020-09-07T00:00:00 +0000",
    "end": "2020-09-13T00:00:00 +0000",
    "satroot": "GOES/NESDIS_CONUS-West",
    "gribroot": "NOAA/HRRR/eddy",
    "tz": "PDT",
    "model": "HRRR",
    "satellite": "GOES-17",
    "res": "1k",
    "sector": "CONUS",
    "area": (-121.33, 32.39, -116.50, 34.66),
    "srs": "anti_mercator",
    "wind": "barbs",
    "barbreduce": 2,
    "barblen": 4.0,
    "alpha": 30.0,
    "size": (1280, 720),
    "POIs": [
        ((-120.4532, 34.4424), "Pt Conception"),
        ((-117.5416, 34.9923), "4 Corners"),
        ((-118.5278, 34.3786), "Santa Clarita"),
        ((-119.7019, 34.4213), "Santa Barbara"),
        #((-118.6051, 33.4783), "West End"),
        ((-118.4086, 33.9435), "LAX"),
        #((-119.0365, 33.4754), "Sta Barbara Is"),
        ((-118.3267, 33.3447), "Avalon"),
        ((-117.6466, 34.2881), "Mt Baldy"),
        ((-116.8246, 34.0984), "San Gorgonio"),
        ((-116.6791, 33.8142), "San Jacinto"),
        ((-116.5467, 33.8445), "Palm Springs"),
        ((-118.4115, 33.7441), "Pt Vicente"),
        ((-117.2409, 32.6653), "Pt Loma"),
    ],
    "title": "Catalina Eddy",
}
regions["Eddy"]["POIs"].extend(FirePOIs)

regions["July"] = {
    "arg": "july",
    "start": "2021-07-16T14:00:00 +0000",
#    "start": "2020-09-05T14:00:00 +0000",
    "end": "2021-10-01T00:00:00 +0000",
    "night_exclude": ("0300", "1330"),
    "satroot": "GOES/NESDIS_CONUS-West",
    "gribroot": "NOAA/HRRR/cahrrr",
    "tz": "PDT",
    "model": "HRRR",
    "satellite": "GOES-17",
    "res": "1k",
    "sector": "CONUS",
    "area": (-123.10, 38.41, -117.11, 41.00),
    "adjust": "right",
    "srs": "anti_mercator",
    "barbreduce": 2,
    "barblen": 4.0,
    "wind": "none",
    "alpha": 40.0,
    "size": (1280, 720),
    "POIs": [
        ((-123.7360, 38.9530), "Pt Arena"),
        ((-122.1948, 41.4098), "Mt Shasta"),
        ((-123.0239, 37.9951), "Pt Reyes"),
        ((-122.4535, 37.8083), "Anita Rk"),
        ((-123.0016, 37.6989), "SE Farallon"),
        ((-122.4830, 37.5026), "Pillar Pt"),
        ((-122.0019, 36.9606), "Santa Cruz"),
        ((-121.9345, 36.6376), "Pt Pinos"),
        ((-122.3922, 40.5876), "Redding"),
        ((-121.8403, 39.7303), "Chico"),
        ((-123.0170, 38.8052), "Cloverdale"),
        ((-122.6335, 38.6692), "Mt St Helena"),
        ((-122.4703, 38.5052), "St Helena"),
        ((-121.9521, 38.3732), "Vacaville"),
        ((-121.4936, 38.5766), "Sacramento"),
        ((-121.2924, 37.9574), "Stockton"),
        ((-119.7892, 36.7362), "Fresno"),
        ((-120.9534, 39.1004), "Colfax"),
        ((-119.7755, 39.5059), "RNO"),
        #((-119.7879, 39.5372), "Reno"),
        ((-119.7605, 39.0105), "North Sails Minden"),
        ((-120.2868, 39.1976), "Squaw"),
        ((-120.0608, 38.6622), "Kirkwood"),
        ((-119.0324, 37.6302), "Mammoth"),
        ((-118.2921, 36.5780), "Mt Whitney"),
        #((-122.2811, 40.3857), "Cottonwood"),
    ],
}
regions["July"]["POIs"].extend(FirePOIs)

CityPOIs = [
        ((-123.7360, 38.9530), "Pt Arena"),
        ((-122.1948, 41.4098), "Mt Shasta"),
        ((-121.5050, 40.4880), "Mt Lassen"),
        ((-123.0239, 37.9951), "Pt Reyes"),
        ((-122.4535, 37.8083), "Anita Rk"),
        ((-123.0016, 37.6989), "SE Farallon"),
        ((-122.4830, 37.5026), "Pillar Pt"),
        ((-122.0019, 36.9606), "Santa Cruz"),
        ((-121.9345, 36.6376), "Pt Pinos"),
        ((-122.3922, 40.5876), "Redding"),
        ((-121.8403, 39.7303), "Chico"),
        ((-123.0170, 38.8052), "Cloverdale"),
        ((-122.6335, 38.6692), "Mt St Helena"),
        ((-122.4703, 38.5052), "St Helena"),
        ((-121.9521, 38.3732), "Vacaville"),
        ((-121.4936, 38.5766), "Sacramento"),
        ((-121.2924, 37.9574), "Stockton"),
        ((-119.7892, 36.7362), "Fresno"),
        #((-121.0621, 39.2191), "Grass Valley"),
        ((-120.9534, 39.1004), "Colfax"),
        ((-120.5764, 38.7631), "Pollock Pines"),
        ((-119.7755, 39.5059), "RNO"),
        #((-119.7879, 39.5372), "Reno"),
        ((-119.7605, 39.0105), "North Sails Minden"),
        ((-120.2868, 39.1976), "Squaw"),
        ((-120.0608, 38.6622), "Kirkwood"),
        ((-119.0324, 37.6302), "Mammoth"),
        ((-118.2921, 36.5780), "Mt Whitney"),
        ((-122.8768, 42.3229), "Medford"),
        ((-123.3249, 42.4434), "Grants Pass"),
        ((-121.7820, 42.2236), "Klamath Falls"),
        #((-122.2811, 40.3857), "Cottonwood"),
    ]

regions["California-large"] = {
    "arg": "cali-large",
    "title": "Active California Fires",
    "tz": "PDT",
    "start": "2020-09-24T18:00:00 +0000",
    "end": "2020-10-01T00:00:00 +0000",
    #"night_exclude": ("0300", "1400"),
    "area": (-132.00, 31.50, -107.00, 42.50), # lat/long of ll, ur (up to Monterey)
    "adjust": "right", # CONUS side
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "model": "HRRR",
    "gribroot": "NOAA/HRRR/cahrrr",
    "srs": "anti_mercator",
    "wind": "none",
    "barbreduce": 20,
    "barblen": 4.0,
    "alpha": 30.0,
    "size": (1920, 1080),
    #"lonlat": "auto",
    "POIs": [
    ],
}
regions["California-large"]["POIs"].extend(FirePOIs)

regions["California-small"] = {
    "arg": "cali-small",
    "title": "Active California Fires",
    "tz": "PDT",
    "start": "2020-09-08T23:40:00 +0000",
    "end": "2020-09-20T00:00:00 +0000",
    #"night_exclude": ("0300", "1400"),
    "area": (-128.00, 32.00, -109.00, 42.50), # lat/long of ll, ur (up to Monterey)
    "adjust": "right", # CONUS side
    "satellite": "GOES-17",
    "satroot": "GOES/NESDIS_CONUS-West",
    "res": "1k",
    "sector": "CONUS",
    "model": "HRRR",
    "gribroot": "NOAA/HRRR/cahrrr",
    "srs": "anti_mercator",
    "wind": "none",
    "barbreduce": 20,
    "barblen": 4.0,
    "alpha": 30.0,
    "size": (600, 440),
    #"lonlat": "auto",
    "POIs": [
    ],
}
regions["California-small"]["POIs"].extend(FirePOIs)

# Weather models
models = {}
models["GFS"] = {
    "frequency": 360,
    "file_pattern": "gfs.t(\d{2})z.pgrb2.0p25.grib2$",
    "crs": "mercator", # GFS GRIB files have invalid proj params!
}

models["HRRR"] = {
    "frequency": 60,
    "file_pattern": "hrrr.t(\d{2})z.wrfsfcf00.grib2$",
    "crs": "usa_lambert_conformal_conic", # not used - use params from HRRR GRIB file
}

# Surface analyses (weather maps)
surfaces = {}
surfaces["Pacific"] = {
    "root": "%s/NOAA/OPC/pacific" % (datastore_prefix),
    "frequency": 6 * 60, # every six hours
    "crop": (0, 8, 2441, 1564), # Cut off top 8 and bottom 36 pixels (text decorations)
    #"crop": (2441-2160, 1488-1215, 2441, 1488),
    "coverageArea": (-225.0, 65.0, -115.0, 16.0), # lon/lat of ul, lr corner of Surface Analysis
    "projection": "anti_mercator",
}

surfaces["Atlantic"] = {
    "root": "%s/NOAA/OPC/atlantic" % (datastore_prefix),
    "frequency": 6 * 60, # every six hours
    "crop": (0, 8, 2441, 1564), # Cut off top 8 and bottom 36 pixels
    "coverageArea": (-100.0, 65.0, 10.0, 16.0), # lon/lat of ul, lr corner of Surface Analysis
    "projection": "mercator",
}

comments = [
    {'ts': "2019-07-13T09:01:00Z", 'c': "Imagery by Lance Berc"},
    {'ts': "2019-07-13T11:30:00Z", 'c': "Eddy is forming on the eve of the start"},
    {'ts': "2019-07-13T14:01:00Z", 'c': "Dawn: Coast is socked-in"},
    {'ts': "2019-07-13T20:56:00Z", 'c': "Start: Clearing north, eddy south"},
    {'ts': "2019-07-14T01:31:00Z", 'c': "Night: Whorls active; Argo escapes" },
    {'ts': "2019-07-14T05:26:00Z", 'c': "Night: Whorls active; PowerPlay, Commanche, Rio100 escape"},
    {'ts': "2019-07-14T11:56:00Z", 'c': "Night: Maserati lights up"},
    {'ts': "2019-07-14T14:11:00Z", 'c': "Dawn: Fleet starts to move"},
    {'ts': "2019-07-14T23:31:00Z", 'c': "Imagery by Lance Berc"},
    {'ts': "2019-09-14T23:31:00Z", 'c': "Imagery by Lance Berc"}, # guard comment
    {'ts': "None", 'c': ""},
]

"""
Find set of satellite images - use these for lowest layer
  GOES-16 & GOES-17 when in mode 6:
  (FD is ~every 10 minutes)
  (CONUS is ~every 5 minutes)
Find set of gribs
  (GFS is every six hours)
  (HRRR is every hour)
For each frame
  For each boat
    interpolate boat position
    convert position to (x,y)
"""

oneday = datetime.timedelta(hours=24)

def find_sat_images(region):
    now = datetime.datetime.now(datetime.timezone.utc);
    r = regions[region]
    startts = datetime.datetime.strptime(r["start"], "%Y-%m-%dT%H:%M:%S %z")
    endts = datetime.datetime.strptime(r["end"], "%Y-%m-%dT%H:%M:%S %z")
    day_ts = startts
    sat_images = []
    pat = re.compile("(\d{12}).jpg$")
    if "night_exclude" in r:
        exclude_start = datetime.datetime.strptime(r["night_exclude"][0], "%H%M")
        exclude_end = datetime.datetime.strptime(r["night_exclude"][1], "%H%M")

    while (day_ts <= (endts + oneday)) and (day_ts <= (now + oneday)):
        path = "%s/%s/%04d%02d%02d" % (datastore_prefix, r["satroot"], day_ts.year, day_ts.month, day_ts.day)
        if not os.path.exists(path) or not os.path.isdir(path):
            logging.debug("Satellite path %s doesn't exist" % (path))
            if len(sat_images) > 0:
                logging.info("%s invalid %d satellite images so far" % (path, len(sat_images)))
            #return sat_images
            day_ts += oneday
            continue;

        l = os.listdir(path)
        l.sort() # doesn't come back sorted on Linux
        logging.debug("find_sat_images ts %s path %s entries %d" % (day_ts, path, len(l)))
        for e in l:
            m = pat.search(e)
            if m:
                tsz = m.group(1) + " +0000"
                ets = datetime.datetime.strptime(tsz, "%Y%m%d%H%M %z")
                if (ets >= startts) and (ets <= endts) and (
                        not "night_exclude" in r or (
                            ((ets.hour < exclude_start.hour) or (ets.hour == exclude_start.hour and ets.minute < exclude_start.minute)) or
                            ((ets.hour > exclude_end.hour) or (ets.hour == exclude_end.hour and ets.minute > exclude_end.minute)))):
                            
                        sat_images.append(("%s/%s" % (path, e), ets))
                    #logging.debug("+ %s  %s <= %s <= %s" % (e, startts, ets, endts))
                #else:
                    #logging.debug("- %s" % (e))
        day_ts += oneday

    logging.info("find_sat_images: %d images" % (len(sat_images)))
    return sat_images

def find_gribs(region):
    r = regions[region]

    if not "model" in r or r["wind"] == "none":
        return None
        
    m = models[r["model"]]
    startts = datetime.datetime.strptime(r["start"], "%Y-%m-%dT%H:%M:%S %z")
    endts = datetime.datetime.strptime(r["end"], "%Y-%m-%dT%H:%M:%S %z")

    # Region start time may be when previous model was active
    day_ts = startts - datetime.timedelta(minutes=m["frequency"] / 2)
    gribs = []
    
    pat = re.compile(m["file_pattern"])

    # Look for gribs in the daily directories but don't try to look in the future
    while day_ts <= (endts + oneday) and day_ts < (datetime.datetime.now(tz=datetime.timezone.utc) + oneday):
        path = "%s/%s/%04d%02d%02d" % (datastore_prefix, r["gribroot"], day_ts.year, day_ts.month, day_ts.day)
        if os.path.exists(path) and os.path.isdir(path):
            l = os.listdir(path)
            l.sort()
            for e in l:
                m = pat.search(e)
                if m:
                    # Use the hour in the filename
                    ets = datetime.datetime(year=day_ts.year, month=day_ts.month, day=day_ts.day, hour=int(m.group(1)), tzinfo=datetime.timezone.utc)
                    if (ets >= startts) and (ets <= endts):
                        gribs.append(("%s/%s" % (path, e), ets))
        else:
            logging.debug("GRIB path %s non-existent" % (path))

        day_ts += oneday

    logging.info("Found %d gribs" % (len(gribs)))
    return gribs

def find_surface_analyses(region):
    r = regions[region]
    if not "surface" in r:
        return None
    sfc = surfaces[r["surface"]]

    halffreq = datetime.timedelta(minutes=sfc["frequency"] / 2)
    # Region start time may be when previous model is active
    startts = datetime.datetime.strptime(r["start"], "%Y-%m-%dT%H:%M:%S %z") - halffreq
    # Region end time may be when next model is active
    endts = datetime.datetime.strptime(r["end"], "%Y-%m-%dT%H:%M:%S %z") + halffreq


    sfcs = []
    path = sfc["root"]
    # Currently all in one directory
    l = os.listdir(path)
    l.sort()
    pat = re.compile("(\d{4})(\d{2})(\d{2})(\d{2})(\d{2}).png$")
    for f in l:
        m = pat.search(f)
        if m:
            fts = datetime.datetime(year=int(m.group(1)), month=int(m.group(2)), day=int(m.group(3)), hour=int(m.group(4)), minute=int(m.group(5)), tzinfo=datetime.timezone.utc)
            if (fts >= startts) and (fts <= endts):
                sfcs.append(("%s/%s" % (path, f), fts))
            if (fts > endts):
                break
    logging.info("Found %d surface analyses" % (len(sfcs)))
    return sfcs    
    
# The EPSG definition of Mercator doesn't allow longitudes that extend 
# past -180 or 180 which makes working in the Pacific difficult. Define
# our own, plus one with the centralized on the anti-meridian to allow 
# working with GOES-17 continuous.
projections = {}
projections["mercator"] = "+proj=merc +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +over"
projections["anti_mercator"] = "+proj=merc +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +over +lon_0=-180"
projections["usa_lambert_conformal_conic"] = "+proj=lcc +lon_0=-96 +lat_0=38 +lat_1=33 +lat_2=45"

#projections["mercator"] = "+proj=merc +datum=WGS84 +units=m +no_defs +over"
#projections["anti_mercator"] = "+proj=web +datum=WGS84 +units=m +no_defs +over +lon_0=-180"

# Constants taken from NASA Product Users Guide, Volume 3, Section 5.1.2
# https://www.goes-r.gov/users/docs/PUG-L1b-vol3.pdf

satellites = {}
satellites["GOES-16"] = { # GOES-16, aka GOES-R, GOES-EAST
    "p_height": 35786023.0,           # perspective height from the ellipsoid
    "height": 42164160.0,             # from center of the earth
    "longitude": -75.0,
    "sweep_axis": 'x',
    "semi_major": 6378137.0,          # GRS-80 ellipsoid
    "semi_minor": 6356752.31414,      # GRS-80 ellipsoid
    "flattening": 298.257222096,
    "eccentricity": 0.0818191910435,
    # The other resolution (.5k, 4k, etc) can be added here
    "1k": {
        "resolution": 0.000028,       # radians per pixel
        "FD": {
            "x_offset": -0.151858,    # radians from nadir
            "y_offset":  0.151858,
            "shape": (10848, 10848),  # pixels in image
            "nanPoint": None          # Need to figure out how to handle off-earth for FD images
        },
        "CONUS": {
            "x_offset": -0.101346,
            "y_offset":  0.128226,
            "shape": (5000, 3000),
            # Brian Blaylock's Gulf of Alaska location for the corner of GOES-16 CONUS that's off-Earth
            "nanPoint": (-152, 57)    # Needed for pcolormesh when using Cartopy
        }
    },
    "2k": {
        "resolution": 0.000056,
        "FD": {
            "x_offset": -0.151844,
            "y_offset":  0.151844,
            #"shape": (5424, 5424),
            "shape": (5424, 5378),
            "nanPoint": None
        },
        "CONUS": {
            "x_offset": -0.101332,
            "y_offset":  0.128212,
            "shape": (2500, 1500),
            "nanPoint": (-152, 57)
        }
    }
}

satellites["GOES-17"] = { # GOES-17, aka GOES-S, GOES-WEST
    "p_height": 35786023.0,
    "height": 42164160.0,
    "longitude": -137.0,
    "sweep_axis": 'x',
    "semi_major": 6378137.0,
    "semi_minor": 6356752.31414,
    "flattening": 298.257222096,
    "eccentricity": 0.0818191910435,
    "1k": {
        "resolution": 0.000028,
        "FD": {
            "x_offset": -0.151858,
            "y_offset":  0.151858,
            "shape": (10848, 10848),
            "nanPoint": None
        },
        "CONUS": {
            "x_offset": -0.069986,
            "y_offset":  0.128226,
            "shape": (5000, 3000),
            "nanPoint": None
        }
    },
    "2k": {
        "resolution": 0.000056,
        "FD": {
            "x_offset": -0.151844,
            "y_offset":  0.151844,
            #"shape": (5424, 5424),
            "shape": (5424, 5378),
            "nanPoint": None
        },
        "CONUS": {
            "x_offset": -0.069972,
            "y_offset":  0.128212,
            "shape": (2500, 1500),
            "nanPoint": None
        }
    },
}

# Make the aspect ratio of the requested lon/lat area match the aspect ratio of the output size
# This is required for georeferencing to work - otherwise the image will not be truly Mercator
def adjustAspectRatio(region, area):
    countLimit = 100
    epsilon = 0.0001
    r = regions[region]
    s = satellites[r["satellite"]]
    res = s[r["res"]]
    sector = res[r['sector']]

    (w, h) = r["size"]
    (left, bottom, right, top) = area
    count = 0
    targetScale = w/h
    while True:
        lonDelta = right - left
        xPixelsPerRadian = w / radians(lonDelta)
        toprad = radians(top)
        topY = log(tan((pi/4) + (toprad/2))) * xPixelsPerRadian
        bottomrad = radians(bottom)
        bottomY = log(tan((pi/4) + (bottomrad/2))) * xPixelsPerRadian
        actualScale = w / (topY-bottomY)
        errorRatio = actualScale/targetScale

        if count == 0:
            logging.debug("Aspect Start Area[%d] ((%.2f, %.2f), (%.2f, %.2f)) Current %.4f Target %.4f (%.4f%%)" % (count, left, right, bottom, top, actualScale, targetScale, errorRatio*100.0))
        if count == countLimit:
            break

        if abs(1-errorRatio) < epsilon:
            break

        if r["adjust"] == "left" or r["adjust"] == "right":
            adjust = (left - right) * ((errorRatio - 1.0)/2.0)
            if r["adjust"] == "left":
                logging.debug("Aspect Ratio Adjust %.4f left %.4f -> %.4f" % (adjust, left, left - adjust))
                left -= adjust
            else:
                logging.debug("Aspect Ratio Adjust %.4f right %.4f -> %.4f" % (adjust, right, right + adjust))
                right += adjust
        else:
            adjust = (top - bottom) * ((errorRatio - 1.0)/2.0)
            if r["adjust"] == "top":
                logging.debug("Aspect Ratio Adjust %.4f top %.4f -> %.4f" % (adjust, top, top + adjust))
                top += adjust
            else:
                logging.debug("Aspect Ratio Adjust %.4f bottom %.2f -> %.4f" % (adjust, bottom, bottom - adjust))
                bottom -= adjust
        count += 1
        
    r["area"] = (left, bottom, right, top)
    if count == countLimit:
        logging.warning("Adjust Aspect Ratio limit exceeded")
    logging.debug("Aspect Final Area[%d] ((%.2f, %.2f), (%.2f, %.2f)) Aspect Ratio %.4f (%.4f%%)" % (count, left, right, bottom, top, actualScale, (actualScale/targetScale)*100.0))

def prep_geometry(region):
    r = regions[region]
    sat = r['satellite']
    s = satellites[sat]

    # GDAL affine transformation
    # Compute upper left corner and resolution (per pixel) in Geostationary coordinates
    # for the image that might be a partial tiling of the entire image
    res = s[r['res']]
    sector = res[r['sector']]
    upper_left_x = sector['x_offset'] * s['p_height']
    upper_left_y = sector['y_offset'] * s['p_height']
    resolution_m = res['resolution'] * s['p_height']
    r['geotransform'] = [upper_left_x, resolution_m, 0, upper_left_y, 0, -resolution_m]

    # Y resolution is negative because scan order goes from top (positive) towards bottom (negative)
    logging.debug("Sat %s GeoTransform [%f, %f, %f, %f, %f, %f]" % (sat, upper_left_x, resolution_m, 0, upper_left_y, 0, -resolution_m))

    # Proj projection geometry
    r["proj"]= "+proj=geos +lon_0=%f +h=%f +a=%f +b=%f +f=%f +units=m +no_defs -ellps=GRS80 +sweep=%s +over" % (
        s['longitude'], s['p_height'], s['semi_major'], s['semi_minor'], 1/s['flattening'], s['sweep_axis'])
    srs = osr.SpatialReference()
    srs.ImportFromProj4(r["proj"])
    r["WKT"] = srs.ExportToWkt()
    
    # Well Known Text (includes Proj description) - should it use PROJ7 now?
    #r['WKT'] = 'PROJCS["unnamed",GEOGCS["unnamed ellipse",DATUM["unknown",SPHEROID["unnamed",%f,%f]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Geostationary_Satellite"],PARAMETER["central_meridian",%f],PARAMETER["satellite_height",%f],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["Meter",1],EXTENSION["PROJ4","%s"]]' % (s['semi_major'], s['flattening'], s['longitude'], s['p_height'], r['proj'])
    logging.debug("Sat %s Proj %s" % (sat, r['proj']))
    logging.debug("Sat %s WKT %s" % (sat, r['WKT']))

kenburns_keyframe = 0
def prep_kenburns(region, ts):
    global kenburns_keyframe
    r = regions[region]
    if not "kenburns" in r:
        return
    path = r["kenburns"]

    (time0, area0) = r["kenburns"][kenburns_keyframe]
    ts0 = datetime.datetime.strptime(time0, "%Y-%m-%dT%H:%M:%S %z")
    while True:
        if kenburns_keyframe == len(path)-1:
            # Use last area if we're at last path element
            adjustAspectRatio(region, area0)
            return
        (time1, area1) = r["kenburns"][kenburns_keyframe+1]
        ts1 = datetime.datetime.strptime(time1, "%Y-%m-%dT%H:%M:%S %z")
        if ts < ts1:
            break
        (time0, area0, ts0) = (time1, area1, ts1)
        kenburns_keyframe += 1
        logging.debug("prep_kenburns advance[%d]: %s %r" % (kenburns_keyframe, time0, area0,))

    # Interpolate 
    partial = (ts - ts0).total_seconds()
    interval = (ts1 - ts0).total_seconds()
    fraction = partial / interval
    area = (
        area0[0] + ((area1[0] - area0[0]) * fraction),
        area0[1] + ((area1[1] - area0[1]) * fraction),
        area0[2] + ((area1[2] - area0[2]) * fraction),
        area0[3] + ((area1[3] - area0[3]) * fraction))
    adjustAspectRatio(region, area)

# Prepare a satellite image - resize and warp it from geos to Mercator
def prep_sat(region, fn):
    r = regions[region]
    (width, height) = r["size"]
    sat = satellites[r["satellite"]]
    if r["sector"] == "FD":
        # The NESDIS FD images have an annoying text strip at the bottom
        jpg = False
        res = sat[r["res"]]
        sector = res[r["sector"]]
        shape = sector["shape"]
        crop = (0,0,shape[0],shape[1])
        logging.debug("Cropping FD image to %r" % (crop,))
        img = Image.open(fn).crop(crop).convert("RGBA")
        logging.debug("Image load and crop(%r) and conversion complete" % (crop,))
        arr = np.array(img)
        logging.debug("img in numpy array")
        transposed = arr.transpose(2, 0, 1)
        src = gdal_array.OpenArray(transposed)
        logging.debug("src in gdal_array")
    else:
        jpg = (fn[-4:] == ".jpg")
        src = gdal.Open(fn, gdal.GA_ReadOnly)
    src.SetProjection(r["WKT"])
    src.SetGeoTransform(r["geotransform"])
    r["invGeotransform"] = gdal.InvGeoTransform(src.GetGeoTransform())

    warpOptions = gdal.WarpOptions(
        format="MEM",
        width = width,
        height = height,
        outputBounds = list(r["area"]),
        outputBoundsSRS="EPSG:4326", # WGS84 - Allows use of lat/lon outputBounds
        # Setting GDAL_PAM_ENABLED should suppress sidecar emission, but it doesn't
        # warpOptions=["SOURCE_EXTRA=1000", "GDAL_PAM_ENABLED=FALSE", "GDAL_PAM_ENABLED=NO"],
        warpOptions=["SOURCE_EXTRA=500"],
        dstSRS=projections[r["srs"]],
        multithread = True,
        )

    if False:
        logging.debug("Driver: {}/{}".format(src.GetDriver().ShortName,
                                             src.GetDriver().LongName))
        logging.debug("Size is {} x {} x {}".format(src.RasterXSize,
                                                    src.RasterYSize,
                                                    src.RasterCount))
        logging.debug("Sat Projection is {}".format(src.GetProjection()))

        geotransform = src.GetGeoTransform()
        if geotransform:
            logging.debug("Sat GeoTransform Origin = ({}, {})".format(geotransform[0], geotransform[3]))
            logging.debug("Sat GeoTransform Pixel Size = ({}, {})".format(geotransform[1], geotransform[5]))
        
    logging.debug("Warping %s" % (fn))
    dst = gdal.Warp('', src, options=warpOptions)
    if not dst:
        logging.info("Warp failed %s" % (fn))
        img = None
    else:
        # Save the projection the first time we warp an image
        if not "crs" in r.keys():
            dstproj = dst.GetProjection()
            r["crs"] = dstproj

            if False:
                sref = osr.SpatialReference()
                sref.ImportFromWkt(dstproj)

                logging.debug("sat sref: %s" % (dstproj))
                logging.debug("sat requested raster bounds: %.2f, %.2f, %.2f, %.2f" % r["area"])

                p1 = pyproj.Proj(dstproj)
                p2 = pyproj.Proj(proj="longlat", datum='WGS84')

                ulx, xres, xskew, uly, yskew, yres = dst.GetGeoTransform()
                lrx = ulx + (dst.RasterXSize * xres)
                lry = uly + (dst.RasterYSize * yres)

                ullon, ullat = pyproj.transform(p1, p2, ulx, uly)
                lrlon, lrlat = pyproj.transform(p1, p2, lrx, lry)
                logging.debug("Post-warp raster bounds: %.2f, %.2f, %.2f, %.2f" % (ullon, lrlat, lrlon, ullat))

        dsta = dst.ReadAsArray() # Array shape is [band, row, col]
        arr = dsta.transpose(1, 2, 0) # Virtually change the shape to [row, col, band]
        if jpg:
            rgb = Image.fromarray(arr, 'RGB')
            img = rgb.convert("RGBA")
        else:
            img = Image.fromarray(arr, 'RGBA') # fromarray() now reads linearly in RGBA order

    src = None
    dst = None
    dsta = None
    arr = None

    # A side effect of setting dst to None is that the sidecar is emmitted when dst is "closed"
    sidecar = "%s.aux.xml" % (fn)
    if os.path.isfile(sidecar): # Would be neat to figure out how to supress sidecar emission
        os.unlink(sidecar)

    return(img)


# Prepare a grib overlay - select the region's area and draw wind barbs or contours
grib_index = 0
grib_image = None
grib_aux = None

def prep_grib(region, ts):
    global grib_index, grib_image, grib_aux
    maxWindScale = 25 # in knots - this is red on the scale
    r = regions[region]
    if (not "model" in r) or (not "wind" in r) or (r["wind"] == "none") or (grib_index == len(r["gribs"])):
        return(None, None)

    m = models[r["model"]]
    halffreq = datetime.timedelta(minutes=m["frequency"] / 2)

    gribs = r["gribs"]
    skipping = False
    while True:
        (fn0, ts0) = gribs[grib_index]
        valid_start = ts0 - halffreq
        valid_end = ts0 + halffreq
        if ts < valid_start:
            logging.debug("prep_grib Before first grib")
            return(None, None)
        if ts <= valid_end:
            break # this is the right grib
        grib_image = None # Changing gribs, invalidate cache
        grib_index += 1
        if grib_index == len(gribs):
            logging.info("prep_grib Past last grib")
            return(None, None)
        (fn0, ts0) = gribs[grib_index]
        if not skipping:
            logging.debug("prep_grib advance[%d] %r" % (grib_index, fn0))
        skipping = True

    if "kenburns" in r:
        grib_image = None # Invalidate when changing "area" each frame

    if grib_image != None:
        # The image didn't change, use cached version
        return(ts0, grib_image)

    (width, height) = r["size"]
    wind = r["wind"]
    reduce = r["barbreduce"]
    barblen = r["barblen"]
    alpha =  r["alpha"]

    # Get wind data from GRIB file
    logging.info("GRIB[%d] %s" % (grib_index, fn0))
    with pygrib.open(fn0) as g:
        # pygrib or grib files are inconsistent wrt longitude ranges - GFS is [0..360] and HRRR is [-180..180]
        (x1, y1, x2, y2) = r["area"]
        if r["model"] == "GFS":
            if (x1 < 0):
                x1 += 360
            if (x2 < 0):
                x2 += 360
            
        logging.debug("prep_grib wind area [(%.2f, %.2f), (%.2f, %.2f)]" % (x1, x2, y1, y2))
        gwind = g.select(name="10 metre U wind component")[0]
        (Um, Ulats, Ulons) = gwind.data(lon1=x1, lon2=x2, lat1=y1, lat2=y2)
        gwind = g.select(name="10 metre V wind component")[0]
        (Vm, Vlats, Vlons) = gwind.data(lon1=x1, lon2=x2, lat1=y1, lat2=y2)

    if grib_aux == None:
        # The lon/lats are the same for each model run so prepare all the XY positions first time through
        grib_aux = {}

        # Beware:
        # -- GFS data is a 2d X, Y array
        # -- HRRR data is a 1d vector
        # Flatten the GFS to 1d so reduce works better
        if len(Um.shape) == 2:
            Ulons = Ulons.flat
            Ulats = Ulats.flat
        if True:
            # Not sure the Proj transformer is working right so use our own lonlat2xy conversion
            veclen = len(Ulons)
            Xvec = np.zeros(veclen)
            Yvec = np.zeros(veclen)
            for i in range(veclen):
                (Xvec[i], Yvec[i]) = lonlat2xy(r["size"], r["area"], Ulons[i], Ulats[i], 0)
        else:
            # Transform the (lon, lats) from the GRIB to image (X, Y)
            # This doesn't take into account that we want an image subset, not the whole world
            crs = gwind.projparams
            if r["model"] == "GFS": # GFS has illegal proj params. I cannot make this up.
                # Should check if crossing anti-meridian - if so use anti-mercator
                m = models[r["model"]]
                crs = projections[m["crs"]]
            #transformer = pyproj.Transformer.from_crs(pyproj.CRS("WGS84"), r["crs"])
            grib_transformer = pyproj.Transformer.from_crs(crs, r["crs"])
            Xvec, Yvec = transformer.transform(Ulons, Ulats)
        grib_aux["Xvec"] = Xvec
        grib_aux["Yvec"] = Yvec
        if (wind == "contours") or (wind == "both"):
            grib_aux["triangulation"] = matplotlib.tri.Triangulation(Xvec, Yvec)
        else:
            grib_aux["triangulation"] = None

    Uvec = Um * 1.94 # Convert from m/s to kts
    Vvec = Vm * 1.94
    # Magnitude vector is length of hypoteneuse of UV triangle
    Mvec = np.sqrt(Uvec**2 + Vvec**2) / maxWindScale # Magnitude - interval [0..1] is [0..25] knots - above will show red

    # Flatten from GFS 2d grid to 1d vector
    if len(Um.shape) == 2:
        Uvec = Uvec.flat
        Vvec = Vvec.flat
        Mvec = Mvec.flat

    # Create a matplotlib figure that is the right size when rendered.
    # matplotlib is designed for pretty images decorated with margins, axes, labels, etc
    # Turning all that off is a PITA.
    matplotlib.use("agg") # "agg" backend can render to RGBA PNG
    fig = plt.figure(figsize=(width / 100, height / 100), frameon=False)

    # Expand axes to 100% of draw area, don't draw axes or labels, no margins
    ax = plt.Axes(fig, [0.0, 0.0, 1.0, 1.0])
    plt.axis('off')
    ax.margins(0)
    ax.tick_params(left=False, labelleft=False, bottom=False, labelbottom=False)
    fig.add_axes(ax)
    cm = matplotlib.cm.get_cmap("jet")     # A colormap that's sort of the rainbow from blue (no wind) to red (25kts)
    plt.ylim(height, 0) # zero is at the top
    plt.xlim(0, width) # zero is on the left

    alpha /= 100.0 # convert from percentage to [0..1]
    if (wind == "contours") or (wind == "both"):
        calpha = alpha/2.0 if args.wind == 'both' else alpha
        triobj = plt.tricontourf(grib_aux["triangulation"], Mvec, maxWindScale, alpha=calpha, cmap=cm)
    
    if (wind == "barbs") or (wind == "both"):
        (Xvec, Yvec) = (grib_aux["Xvec"], grib_aux["Yvec"])
        img = plt.barbs(Xvec[::reduce], Yvec[::reduce], Uvec[::reduce], Vvec[::reduce], Mvec[::reduce], fill_empty=False, alpha=alpha, cmap=cm, length=barblen)

    canvas = plt.get_current_fig_manager().canvas
    canvas.draw()

    # Render to RGBA PNG keeping transparency, then read back into Image
    # Other methods and backends lost transparency
    # Set bbox_inches and pad_inches to get rid of white space
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches=0.0, pad_inches=0.0, transparent=True)
    plt.close()
    buf.seek(0)
    grib_image = Image.open(buf)
    grib_image.load()
    buf.close()
    return(ts0, grib_image)

# simplifying assumption:
# - only one GPX file
# - only one track
# - points come pre-sorted in the gpx file
# this will need rethinking for plotting fleets

def find_gpx(region):
    r = regions[region]
    if not "gpxfn" in r:
        return
    f = open(r["gpxfn"], 'r')
    logging.debug("Parsing %s" % (r["gpxfn"]))
    gpx = gpxpy.parse(f)
    points = []

    #tzlocal = datetime.timezone.utc
    # this hasn't been tested - plus we assume timestamps are in UTC
    tzinfo = zoneinfo.ZoneInfo("UTC")
    
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                # Kludgey - maybe add tz info everywhere else?
                points.append([point.time.replace(tzinfo=tzinfo), point.longitude, point.latitude])
                #points.append([point.time, point.longitude, point.latitude])
            #print('Point at ({0},{1}) -> {2}'.format(point.latitude, point.longitude, point.elevation))
            #print('Point %r' % (point,))
            #print('(%7.2f, %7.2f) @ %s' % (point.latitude, point.longitude, datetime.datetime.strftime(point.time, "%Y-%m-%d %H:%MZ")))
    points.sort(key=lambda x: x[0]) # sort in time order just in case
    r["gpx"] = points
    logging.debug("GPX %s contains %d points %s - %s" % (r["gpxfn"], len(points), datetime.datetime.strftime(points[0][0], "%Y-%m-%d %H:%MZ"), datetime.datetime.strftime(points[len(points)-1][0], "%Y-%m-%d %H:%MZ")))

# Found this formula on stackoverflow:
# x from longitude is just the percentage of the map's longitude span since Mercator is constant pixels per degree
# y from latitude is trickier and I don't know the derivation of this formula other than it uses the base as a scale factor

def lonlat2xy(size, area, lon, lat, method):
    w, h = size
    (left, bottom, right, top) = area

    """
src = gdal.Open(filename)
#if the file contains GeoTransform
geotrans = src.GetGeoTransform()
#if the file contains only GCPs
gcps = src.GetGCPs()
geotrans = gdal.GCPsToGeoTransform(gcps)

#from pixel coordinate to lat/lon
lat, lon = gdal.ApplyGeoTransform(geoTrans, x,y)

# from lat/lon to pixel coordinate
invTs = gdal.InvGeoTransform(ts)
x, y = gdal.ApplyGeoTransform(invTs, lat, lon)
    """
    if False:
        invGT = gdal.InvGeoTransform(r["geaotransform"])
        (x, y) = gdal.ApplyGeoTransform(invGT, lon, lat)
    if False:
        crs_4326 = pyproj.CRS("WGS84")
        crs_proj = pyproj.CRS(projections["mercator"])
        transformer = pyproj.Transformer.from_crs(crs_4326, r["crs"])
        (x, y) = transformer.transform(lon, lat)
        return(x, y)
                
    lonDelta = right - left
    if lon > 180:
        lon -= 360

    # x is simple percentage of image width
    x = w * ((lon - left) / lonDelta)
    #logging.debug("lonlat2xy: %d * ((%.2f -%.2f) / %.2f) = %.2f" % (w, lon, left, lonDelta, x))
    latrad = radians(lat)
    bottomrad = radians(bottom)
    toprad = radians(top)
    xPixelsPerRadian = w / radians(lonDelta)
    scale = xPixelsPerRadian

    #logging.debug("GPX xPixelsPerRadian: %f" % (xPixelsPerRadian))
    if method == 0:
        #r = regions["BayDelta"]
        #(x0, y0) = gdal.ApplyGeoTransform(r["invGeotransform"], lon, lat)
        #logging.debug("lonlat2xy invGeotransform (%.2f, %.2f) -> (%.1f, %.1f) " % (lon,lat, x0, y0))
        
        # XXX For some reason the xPixelsPerRadian scale factor is too large
        # XXX But if you average offsetting from the top and bottom it's right
        # XXX This is very, very kludgey and wrong
        topY = log(tan((pi/4) + (toprad/2))) * xPixelsPerRadian
        bottomY = log(tan((pi/4) + (bottomrad/2))) * xPixelsPerRadian
        gpxY = log(tan((pi/4) + (latrad/2))) * xPixelsPerRadian
        y1 = h - (gpxY - bottomY)
        y2 = topY - gpxY
        y = (y1 + y2) / 2
    elif method == 1:
        bottomY = log(tan((pi/4) + (bottomrad/2))) * xPixelsPerRadian
        gpxY = log(tan((pi/4) + (latrad/2))) * xPixelsPerRadian
        y = h - (gpxY - bottomY)
    elif method == 2:
        topY = log(tan((pi/4) + (toprad/2))) * xPixelsPerRadian
        gpxY = log(tan((pi/4) + (latrad/2))) * xPixelsPerRadian
        y = topY - gpxY
    elif method == 3:
        gpxY = log((1+sin(latrad)) / (1-sin(latrad))) * (xPixelsPerRadian / 2)
        bottomY = log((1+sin(bottomrad)) / (1-sin(bottomrad))) * (xPixelsPerRadian / 2)
        y = h - (gpxY - bottomY)
    elif method == 4:
        topY = log((1+sin(toprad)) / (1-sin(toprad))) * (xPixelsPerRadian / 2)
        gpxY = log((1+sin(latrad)) / (1-sin(latrad))) * (xPixelsPerRadian / 2)
        y = topY - gpxY
    return (x, y)
    

    """
    $x = ($lon - $mapLonLeft) * ($mapWidth / $mapLonDelta);

    $lat = $lat * M_PI / 180;
    $worldMapWidth = (($mapWidth / $mapLonDelta) * 360) / (2 * M_PI);
    $mapOffsetY = ($worldMapWidth / 2 * log((1 + sin($mapLatBottomDegree)) / (1 - sin($mapLatBottomDegree))));
    $y = $mapHeight - (($worldMapWidth / 2 * log((1 + sin($lat)) / (1 - sin($lat)))) - $mapOffsetY);

    """
    
def prep_gpx(region, ts):
    r = regions[region]

    if not "gpx" in r:
        return None
    gpx = r["gpx"]

    lastfix = len(gpx) - 1

    if (lastfix < 0):
        logging.debug("GPX no points defined")
        return None

    fix = 0
    (ts0, lon0, lat0) = gpx[fix]
    logging.debug(    "GPX ts %s" % (ts))
    if (ts < ts0):
        logging.debug("GPX ts %s < first point %s" % (ts, ts0))
        return None

    fixes = ([],[],[],[],[])
    xs = []
    ys = []
    while (fix <= lastfix) and (ts >= gpx[fix][0]):
        (ts0, lon0, lat0) = gpx[fix]
        for i in range(5):
            x, y = lonlat2xy(r["size"], r["area"], lon0, lat0, i)
            fixes[i].append((x,y))
            #logging.debug("GPX point[%d] @ %s (%.2f, %.2f) -> (%d, %d)" % (fix, datetime.datetime.strftime(ts0, '%Y-%m-%d %H:%MUTC'), lon0, lat0, x, y))
        fix += 1

    # interpolate last point
    if (fix <= lastfix):
        (ts1, lon1, lat1) = gpx[fix]
        partial = (ts - ts0).total_seconds()
        interval = (ts1 - ts0).total_seconds()
        fraction = partial / interval
        lon = lon0 + ((lon1 - lon0) * fraction)
        lat = lat0 + ((lat1 - lat0) * fraction)
        for i in range(5):
            x, y = lonlat2xy(r["size"], r["area"], lon, lat, i)
            fixes[i].append((x,y))
        logging.debug("GPX final[%d] @ %s %s < %s < %s %.2f%% (%.2f, %.2f) -> (%d, %d)" % (fix, ts, datetime.datetime.strftime(ts0, '%H:%MUTC'), datetime.datetime.strftime(ts, '%H:%MUTC'), datetime.datetime.strftime(ts1, '%H:%MUTC'), fraction*100, lon, lat, x, y))
    else:
        logging.debug("GPX no final interpolation: %d >= %d" % (fix, lastfix))

    img = Image.new("RGBA", r["size"])
    draw = ImageDraw.Draw(img)
    colors = ["red", "green", "blue", "yellow", "cyan"]
    sizes = (2, 4, 4, 2, 2)
    # Setting range(1) means only red is drawn - to see all, use range(5)
    for i in range(1):
        # Draw a line connecting the fixes
        draw.line(fixes[i], fill=colors[i], width=2)
        # Draw a filled circle at each fix
        for f in range(fix):
            (x, y) = fixes[i][f]
            s = sizes[i]
            draw.ellipse([(x-s, y-s), (x+s, y+s)], fill=colors[i])
    return(img)
    

    """
    # Create a matplotlib figure that is the right size when rendered.
    # matplotlib is designed for pretty images decorated with margins, axes, labels, etc
    # Turning all that off is a PITA.
    (width, height) = r["size"]
    matplotlib.use("agg") # "agg" backend can render to RGBA PNG
    fig = plt.figure(figsize=(width / 100, height / 100), frameon=False)

    # Expand axes to 100% of draw area, don't draw axes or labels, no margins
    ax = plt.Axes(fig, [0.0, 0.0, 1.0, 1.0])
    #plt.axis('off')
    ax.margins(0)
    ax.tick_params(left=False, labelleft=False, bottom=False, labelbottom=False)
    fig.add_axes(ax)
    cm = matplotlib.cm.get_cmap("jet")     # A colormap that's sort of the rainbow from blue (no wind) to red (25kts)
    plt.xlim(0, width)
    plt.ylim(0, height)

    logging.debug("GPX xs %r" % (xs))
    logging.debug("GPX ys %r" % (ys))
    plt.plot(xs, ys, '-Dr')

    canvas = plt.get_current_fig_manager().canvas
    canvas.draw()

    # Render to RGBA PNG keeping transparency, then read back into Image
    # Other methods lost transparency
    # Set bbox_inches and pad_inches to get rid of white space
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches=0.0, pad_inches=0.0, transparent=True)
    plt.close()
    buf.seek(0)
    img = Image.open(buf)
    img.load()
    buf.close()
    return(img)
    """

# Radius of the earth at latitude B
# https://stackoverflow.com/questions/56420909/calculating-the-radius-of-earth-by-latitude-in-python-replicating-a-formula
def radius (B):
    B= radians(B) #converting into radians
    a = 6378.137  #Radius at sea level at equator (semi-major axis)
    b = 6356.752  #Radius at poles (semi-minor axis)
    c = (a**2*cos(B))**2
    d = (b**2*sin(B))**2
    e = (a*cos(B))**2
    f = (b*sin(B))**2
    R = sqrt((c+d)/(e+f))
    return R

surface_index = 0
surface_base = None
surface_image = None
surface_size = None
def prep_surface_analysis_numpy(region, ts):
    r = regions[region]
    global surface_index, surface_base, surface_image, surface_size
    
    if (not "surface" in r):
        return (None, None)
    sfc = surfaces[r["surface"]]
    sfcs = r["sfcs"]
    if surface_index == len(sfcs):
        return(None, None)

    halffreq = datetime.timedelta(minutes=sfc["frequency"] / 2)

    while True:
        (fn0, ts0) = sfcs[surface_index]
        valid_start = ts0 - halffreq
        valid_end = ts0 + halffreq
        if ts < valid_start:
            logging.debug("prep_sfc before first chart")
            return(None, None)
        if ts <= valid_end:
            # ts is in valid range - this is the right sfc
            break
        # ts later than valid range - invalidate cache, look for correct sfc
        (surface_base, surface_image, surface_size) = (None, None, None)
        surface_index += 1
        if surface_index == len(sfcs):
            logging.info("prep_sfc past last surface analysis")
            return(None, None)
        (fn0, ts0) = sfcs[surface_index]
        logging.debug("prep_surface advance[%d] %r" % (surface_index, fn0))

    # Prep a base image if one isn't cached
    if surface_base == None and ts <= valid_end:
        logging.info("prep_surface prep[%d] %s" % (surface_index, fn0))
        img = Image.open(fn0).crop(sfc["crop"]).convert('RGBA')
        arr = np.array(img)

        # There might be a more clever way to do this with less numpy broadcasts
        # Treat any pixel with dark RGB as black
        rmask = arr[:, :, 0] < 50
        gmask = arr[:, :, 1] < 50
        bmask = arr[:, :, 2] < 50
        tmp = np.logical_and(rmask, gmask)
        black = np.logical_and(tmp, bmask)
    
        # OTOH, only white is white
        rmask = arr[:, :, 0] == 255
        gmask = arr[:, :, 1] == 255
        bmask = arr[:, :, 2] == 255
        tmp = np.logical_and(rmask, gmask)
        white = np.logical_and(tmp, bmask)
    
        # Change black to white and white to transparent
        arr[black] = [255, 255, 255, 255]
        arr[white] = [0, 0, 0, 0]

        # Turn numpy array into a GDAL dataset in band-major order
        transposed = arr.transpose(2, 0, 1)
        surface_base = gdal_array.OpenArray(transposed)

        # Prepare geolocation and projection parameters
        proj = projections[sfc["projection"]]
        srs = osr.SpatialReference()
        srs.ImportFromProj4(proj)
        surface_base.SetProjection(srs.ExportToWkt())
    
        (width, height) = img.size
        surface_size = (width, height)
        left, top, right, bottom = sfc["coverageArea"]

        gcps = []
        # gcp(x, y, z, lon, lat)
        # There is undocumented code in GCPsToGeoTransform that recognizes this order of GCPs
        gcps.append(gdal.GCP(left, top, 0, 0, 0))
        gcps.append(gdal.GCP(right, top, 0, width, 0))
        gcps.append(gdal.GCP(right, bottom, 0, width, height))
        gcps.append(gdal.GCP(left, bottom, 0, 0, height))
        geotransform = gdal.GCPsToGeoTransform(gcps)
        surface_base.SetGeoTransform(geotransform)
        #surface_base.SetGCPs(gcps, srs.ExportToWkt()) # This should also work

    # translate to output area if first use of sfc or if each sat image has unique output area
    if ("kenburns" in r) or (surface_image == None):
        logging.debug("prep_surface warp")
        (width, height) = surface_size
        left, top, right, bottom = sfc["coverageArea"]
        
        (dleft, dbottom, dright, dtop) = r["area"]
        (ulx, uly) = lonlat2xy((width, height), (left, bottom, right, top), dleft, dtop, 0)
        (lrx, lry) = lonlat2xy((width, height), (left, bottom, right, top), dright, dbottom, 0)

        (cols, rows) = r["size"]
        translateOptions = gdal.TranslateOptions(
            format="MEM",
            width=cols,
            height=rows,
            srcWin=[ulx, uly, lrx-ulx, lry-uly],
            #projWin=[dleft, dtop, dright, dbottom],
        )
        dst = gdal.Translate('', surface_base, options=translateOptions)
        if not dst:
            logging.error("Surface Analysis translate failed %s" % (fn))
            dst = None
            return(None, None)
    
        dsta = dst.ReadAsArray() # Array shape is [band, row, col]
        arr = dsta.transpose(1, 2, 0) # Virtually change the shape to [row, col, band]
        surface_image = Image.fromarray(arr, 'RGBA') # transposed arr reads linearly in RGBA order

        #src = None
        dst = None
        arr = None
        sidecar = "%s.aux.xml" % (fn0)
        if os.path.isfile(sidecar): # Would be neat to figure out how to supress sidecar emission
            logging.debug("Removing sidecar %s" % (sidecar))
            os.unlink(sidecar)

    return (ts0, surface_image)



fonts = {}

fontfamily = "lucon.ttf" # on windows
fontfamily = "Courier_New.ttf" # on Linux after installing ttf-mscorefonts-installer
fontfamily = "cour.ttf" # on Linux after installing ttf-mscorefonts-installer

def prep_fonts(region):
    r = regions[region]
    (w, h) = r["size"]
    if h < 500:
        fonts["POI"] = ImageFont.truetype(fontfamily, 8)
        fonts["tspad"] = 2
        fonts["llyoffset"] = 3
        fonts["label"] = ImageFont.truetype(fontfamily, 14)
        (left, right, top, bottom) = fonts["label"].getbbox("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\|;:',<.>/?") 
        fonts["label_size"] = (right - left, top - bottom)
    elif h < 1080:
        fonts["POI"] = ImageFont.truetype("times.ttf", 12)
        fonts["tspad"] = 2
        fonts["llyoffset"] = 3
        fonts["label"] = ImageFont.truetype(fontfamily, 18)
        (left, right, top, bottom) = fonts["label"].getbbox("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\|;:',<.>/?") 
        fonts["label_size"] = (right - left, top - bottom)
    else:
        fonts["POI"] = ImageFont.truetype(fontfamily, 20)
        fonts["tspad"] = 4
        fonts["llyoffset"] = 4
        fonts["label"] = ImageFont.truetype(fontfamily, 28)
        (left, right, top, bottom) = fonts["label"].getbbox("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\|;:',<.>/?") 
        fonts["label_size"] = (right - left, top - bottom)
    
# Annotate with latitudes on the left and longitudes along the bottom.
def draw_lonlats(region, canvas, draw):
    r = regions[region]
    if not "lonlat" in r:
        return

    # Currently auto is the only method
    if r["lonlat"] != "auto":
        return

    pad = 1
    size = 3
    font = fonts["POI"]
    #fw, fh = font.getsize("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\|;:',<.>/?")
    
    bg = 0x00
    bgalpha = 0x80
    fg = 0xff
    
    (left, bottom, right, top) = r["area"]
    lat = bottom + ((top - bottom) * 0.05)
    for lon in range(int(left), int(right)+1):
        (x, y) = lonlat2xy(r["size"], r["area"], lon, lat, 0)
        draw.polygon([(x, y-size), (x-size, y), (x, y+size), (x+size, y)], outline="white", fill="blue")
        label = "%d%s" % (abs(lon), ("E" if (lon >= 0) else "W"))

        (left, right, top, bottom) = font.getbbox(label) 
        w, h = (right - left, top - bottom)

        x += size + pad
        y -= h/2
        w = pad + w + pad
        h = pad + h + pad
        draw.rectangle(((x, y), (x+w, y+h)), fill=(bg, bg, bg, bgalpha))
        draw.text((x+pad, y+pad), label, fill=(fg, fg, fg, 0xff), font = font)
    lon = left + ((right - left) * 0.05)
    for lat in range(int(bottom), int(top)+1):
        (x, y) = lonlat2xy(r["size"], r["area"], lon, lat, 0)
        draw.polygon([(x, y-size), (x-size, y), (x, y+size), (x+size, y)], outline="white", fill="blue")
        label = "%d%s" % (abs(lat), ("N" if (lat >= 0) else "S"))
        (left, right, top, bottom) = font.getbbox(label) 
        w, h = (right - left, top - bottom)
        x += size + pad
        y -= h/2
        w = pad + w + pad
        h = pad + h + pad
        draw.rectangle(((x, y), (x+w, y+h)), fill=(bg, bg, bg, bgalpha))
        draw.text((x+pad, y+pad), label, fill=(fg, fg, fg, 0xff), font = font)

def draw_POIs(region, canvas, draw):
    r = regions[region]
    if "lines" in r:
        for ((lon1, lat1), (lon2, lat2)) in r["lines"]:
            (x1, y1) = lonlat2xy(r["size"], r["area"], lon1, lat1, 0)
            (x2, y2) = lonlat2xy(r["size"], r["area"], lon2, lat2, 0)
            draw.line([(x1, y1), (x2, y2)], fill="blue", width=2)
    draw_lonlats(region, canvas, draw)
    if "POIs" in r:
        pad = 1
        size = 3
        font = fonts["POI"]
        #fw, fh = font.getsize("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\|;:',<.>/?")

        bg = 0x00
        bgalpha = 0x80
        fg = 0xff
    
        for poi in r["POIs"]:
            fill = "blue"
            if len(poi) == 2:
                ((lon, lat), label) = poi
            else:
                ((lon, lat), label, fill) = poi
            (x, y) = lonlat2xy(r["size"], r["area"], lon, lat, 0)
            draw.polygon([(x, y-size), (x-size, y), (x, y+size), (x+size, y)], outline="white", fill=fill)

            left, right, top, bottom = font.getbbox(label) 
            w = right - left
            h = top - bottom

            x += size + pad
            y -= h/2
            w = pad + w + pad
            h = pad + h + pad
            draw.rectangle(((x, y), (x+w, y+h)), fill=(bg, bg, bg, bgalpha))
            draw.text((x+pad, y+pad), label, fill=(fg, fg, fg, 0xff), font = font)
    
def annotate(canvas, draw, where, text):
    (cw, ch) = canvas.size
    (ttwidth, ttheight) = fonts["label_size"]
    tspad = fonts["tspad"]
    llyoffset = fonts["llyoffset"]
    ttfont = fonts["label"]
    
    for i in range(len(text)):
        bg = 0x00
        bgalpha = 0x80
        fg = 0xff
        left, right, top, bottom = ttfont.getbbox(text[i]) 
        w = right - left
        h = top - bottom

        if (where == "UL"):
            x = 2
            y = 2 + (i * (2*tspad + ttheight))
        if (where == "LL"):
            x = 2
            y = ch - (llyoffset + ((len(text) - r) * (2*tspad + ttheight)))
            bg = 0xff
            bgalpha = 0xff
            fg = 0x00
        if (where == "UR"):
            x = cw - ((2 * tspad) + w)
            y = 2 + (i * (2*tspad + ttheight))
        w = tspad + w + tspad
        h = tspad + ttheight + tspad
        draw.rectangle((x, y, x+w, y+h), fill=(bg, bg, bg, bgalpha))
        draw.text((x+tspad, y+tspad), text[i], fill=(fg, fg, fg, 0xff), font = ttfont)

def decorate(region, canvas, draw, sat_ts, sfc_ts, grib_ts):
    r = regions[region]
    tz = r["tz"]
    #offset = timezones[tz]
    #logging.debug("decorate tz %s offset %d" % (tz, offset))
    grib_string = None
    if grib_ts != None:
        grib_string = "%s %s" % (datetime.datetime.strftime(grib_ts, '%Y-%m-%d %H:%MUTC'), r["model"])
    sfc_string = None
    if sfc_ts != None:
        sfc_string = "%s %s" % (datetime.datetime.strftime(sfc_ts, '%Y-%m-%d %H:%MUTC'), "OPC") # XXX get sfc overlay name
    dt = sat_ts.astimezone(zoneinfo.ZoneInfo(tz))
    sat_string = "%s%s %s" % (datetime.datetime.strftime(dt, '%Y-%m-%d %H:%M'), dt.tzname(), r["satellite"])

    s = []
    if ("title" in r) and (r["title"] != None):
        s.append(r["title"])
    if sat_string != None:
        s.append(sat_string)
    if sfc_string != None:
        s.append(sfc_string)
    if grib_string != None:
        s.append(grib_string)
    annotate(canvas, draw, "UL", s)
    if ("attribution" in r):
        s = []
        s.append(r["attribution"][0]['c'])
        annotate(canvas, draw, "UR", s)

def process_region(region):
    logging.debug("Processing region %s" % (region))
    r = regions[region]

    if args.size != None:
        (width, height) = (None, None)
        m = re.match("(\d+)x(\d+)", args.size)
        if m:
            (width, height) = m.groups()
        if (width == None) or (height == None):
            logging.critical("Illegal [width]x[height] '%s" % (args.size))
            return
        logging.debug("Setting output size to %d x %d" % (int(width), int(height)))
        r["size"] = (int(width), int(height))
                        

    # Initialize "area" - if KenBurns this is done every frame
    adjustAspectRatio(region, r["area"])

    prep_fonts(region)

    prep_geometry(region)

    sat_images = find_sat_images(region)
    if len(sat_images) == 0:
        logging.info("No satellite images found")
        return
    if args.latest:
        args.recent = 1
    if args.recent:
        sat_images = sat_images[-args.recent:]
    cur_sat = None
    last_day = 0

    gribs = find_gribs(region)
    if r["wind"] != "none" and "model" in r and r["model"] != None and (gribs == None or (len(gribs) == 0 and not args.ignorelastgrib)):
        logging.info("No GRIB files found")
        return
    r["gribs"] = gribs
    r["sfcs"] = find_surface_analyses(region)

    if "surface" in r and not args.ignorelastsurface and (r["sfcs"] == None or len(r["sfcs"]) == 0):
        logging.info("No surface analyses files found")
        return

    find_gpx(region)

    skipping = False
    for cur_sat in sat_images:
        (sat_fn, sat_ts) = cur_sat

        if sat_ts.day != last_day:
            odir = "%s%s/%s/%04d%02d%02d" % (datastore_prefix, output_prefix, region, sat_ts.year, sat_ts.month, sat_ts.day)
            if not os.path.isdir(odir):
                logging.info("Create directory %s" % (odir))
                os.makedirs(odir)
            last_day = sat_ts.day

        ofn = "%s/%04d%02d%02d_%02d%02d.jpg" % (odir, sat_ts.year, sat_ts.month, sat_ts.day, sat_ts.hour, sat_ts.minute)
        if os.path.exists(ofn):
            if not skipping:
                logging.debug("Skipping (exists) %s" % (ofn))
                logging.debug("Supressing skip messages")
            skipping = True
            continue

        skipping = False
        logging.debug("Satellite image %s" % (sat_fn))

        # Create the satellite background image
        prep_kenburns(region, sat_ts) # adjusts the "area" (treated as a global) for this image

        img = prep_sat(region, sat_fn) # Base image - everything is overlayed onto this

        (sfc_ts, sfc) = prep_surface_analysis_numpy(region, sat_ts)
        if sfc != None:
            img = Image.alpha_composite(img, sfc)
        else:
            if (r["sfcs"] != None) and (not args.ignorelastsurface) and (surface_index == len(r["sfcs"])):
                logging.info("process_region Past last surface analysis")
                return
            if (r["sfcs"] != None):
                logging.info("process_region No Surface Analysis %s" % (sat_ts))

        (grib_ts, grib) = prep_grib(region, sat_ts)
        if grib != None:
            img = Image.alpha_composite(img, grib)
        else:
            if (r["gribs"] != None) and (not args.ignorelastgrib) and (grib_index == len(r["gribs"])):
                logging.info("process_region Past last grib")
                return
            if (r["gribs"] != None):
                logging.info("process_region No grib file %s" % (sat_ts))
            
        track = None
        if "gpx" in r:
            track = prep_gpx(region, sat_ts)
            if track != None:
                img = Image.alpha_composite(img, track)

        if not ("decorate" in r) or r["decorate"] != "none":
            # Create a canvas for all other decoration
            canvas = Image.new("RGBA", r["size"], 0)
            draw = ImageDraw.Draw(canvas)

            # paint boats onto image
            draw_POIs(region, canvas, draw)
        
            # Paint timestamps for satellite image and grib
            decorate(region, canvas, draw, sat_ts, sfc_ts, grib_ts)
        
            # decorate with comments
        
            img = Image.alpha_composite(img, canvas)
            del draw
            canvas.close()

        #img.save("%s.png" % (ofn[:-4]), "PNG")
        img = img.convert("RGB")
        logging.info("Save %s" % (ofn))
        img.save(ofn, "JPEG")
        
        bdir = "%s%s/%s" % (datastore_prefix, output_prefix, region)
        latest = "%s/%s" % (bdir, "latest.jpg")
        if os.path.lexists(latest): # lexists returns true if the path is good or the link is broken
            try:
                os.unlink(latest)
            except OSError as err:
                print("Error unlinking %s: %s (error type %s)" % (latest, err, type(err)))
        try:
            os.symlink(ofn, latest)
        except OSError as err:
            print("Error linking %s -> %s: %s (error type %s)" % (latest, ofn, err, type(err)))

        if args.oneshot == True:
            return

args = None
if __name__ == '__main__':
    loglevel = logging.DEBUG
    parser = argparse.ArgumentParser()

    choices = []
    choicemap = {}
    for r in regions:
        if regions[r]["arg"] != "":
            choices.append(regions[r]["arg"])
            choicemap[regions[r]["arg"]] = r
    parser.add_argument("-region", choices=choices, help="Region to process", required=True)
    parser.add_argument("-size", action='store', help="Size [width]x[height]")

    parser.add_argument("-adjust", choices=["left", "right", "top", "bottom"], help="Edge moved to adjust aspect ratio (defaults to bottom if not defined in region)")

    parser.add_argument("-alpha", action='store', type=float, help="Wind barb/contour opacity percentage [0..100]")
    parser.add_argument("-reduce", action='store', type=int, choices=range(0,20), help="Barb density decimation")
    parser.add_argument("-wind", choices=["barbs", "contours", "both", "none"], help="Wind display")
#    parser.add_argument("-barblen", action='store', type=float, choices=range(1,20), default=4.0, help="Wind barb length")
    parser.add_argument("-barblen", action='store', type=float, help="Wind barb length")

    parser.add_argument("-ignorelastgrib", action='store_true', default=False, help="Continue past last GRIB w/no overlays")
    parser.add_argument("-ignorelastsurface", action='store_true', default=False, help="Continue past last Surface Analysis w/no overlays")
    parser.add_argument("-oneshot", action='store_true', default=False, help="Process one image and exit")
    parser.add_argument("-recent", action='store', type=int, help="Process only last N source images")
    parser.add_argument("-latest", action='store_true', default=False, help="Process only last source image - takes precedence over recent")
    parser.add_argument("-start", action='store', help="Start YYYYMMDDHHMM[+zzzz] (Zulu unless optional TZ HHMM offset)")
    parser.add_argument("-end", action='store', help="End YYYYMMDDHHMM[+zzzz] (Zulu unless optional TZ HHMM offset)")
    parser.add_argument("-since", action='store', help="Last Nd (days) or Nh (hours)");
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

    r = regions[choicemap[args.region]]
    if args.start != None:
        t = args.start
        r["start"] = "%s-%s-%sT%s:%s:00 +0000" % (t[0:4], t[4:6], t[6:8], t[8:10], t[10:12])
        if len(t) > 12:
            r["start"] = "%s-%s-%sT%s:%s:00 +%s" % (t[0:4], t[4:6], t[6:8], t[8:10], t[10:12], t[14:18])
    if args.end != None:
        t = args.end
        r["end"] = "%s-%s-%sT%s:%s:00 +0000" % (t[0:4], t[4:6], t[6:8], t[8:10], t[10:12])
        if len(t) > 12:
            r["end"] = "%s-%s-%sT%s:%s:00 +%s" % (t[0:4], t[4:6], t[6:8], t[8:10], t[10:12], t[14:18])
    if args.wind != None:
        r["wind"] = args.wind
    if args.reduce != None:
        r["barbreduce"] = args.reduce
    if args.barblen != None:
        r["barblen"] = args.barblen
    if args.alpha != None:
        r["alpha"] = args.alpha
    if args.adjust != None:
        r["adjust"] = args.adjust
    if not "adjust" in r:
        r["adjust"] = "bottom"
    if args.since != None:
        if args.since[-1] == 'h':
            hours = int(args.since[0:-1]);
        elif args.since[-1] == 'd':
            hours = int(args.since[0:-1]) * 24;
        else:
            logging.info('Illegal "since" duration "%s" - must end in "d" or "h"' % (args.since));
            exit(1);
        now = datetime.datetime.now(datetime.timezone.utc);
        delta = datetime.timedelta(hours = hours);
        since = now - delta;
        r["start"] = since.strftime("%Y-%m-%dT%H:%M:00 +0000");
        logging.debug("Start time since: %s" % (r["start"]));

    process_region(choicemap[args.region])
