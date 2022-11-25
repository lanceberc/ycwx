FROM osgeo/gdal:ubuntu-small-3.6.0

RUN apt update

RUN DEBIAN_FRONTEND=noninteractive apt install -y tzdata ttf-mscorefonts-installer \
    && apt install -y software-properties-common build-essential mlocate wget graphicsmagick fontconfig

RUN add-apt-repository -y ppa:deadsnakes/ppa \
    && apt install -y python3-dateutil python3.10-dev \
    && wget https://bootstrap.pypa.io/get-pip.py && python get-pip.py && rm -f get-pip.py \
    && pip install pyproj matplotlib gpxpy pytz debugpy

RUN updatedb \
    && fc-cache -vr && fc-list \
    && ln -s /docker /home/stfyc

CMD ["tail", "-f", "/dev/null"]