FROM osgeo/gdal:ubuntu-small-3.6.0

RUN apt update

RUN DEBIAN_FRONTEND=noninteractive apt install -y tzdata \
    && apt install -y software-properties-common build-essential mlocate wget graphicsmagick fontconfig ffmpeg libcjson-dev git cmake libssl-dev

RUN apt install -y python3-dateutil python3.10-dev \
    && cd /tmp && wget https://bootstrap.pypa.io/get-pip.py && python get-pip.py \
    && pip install pyproj matplotlib gpxpy pytz debugpy

# Accept the license agreement upon install, per http://askubuntu.com/a/25614
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt install -y --no-install-recommends fontconfig ttf-mscorefonts-installer \
    && fc-cache -f -v

# sensord depends on libwebsockets v4.3.2 which must be built from source
RUN cd /tmp && git clone https://libwebsockets.org/repo/libwebsockets && cd libwebsockets && git checkout v4.3.2 \
    && mkdir build && cd build && cmake .. && make && make install

# Set this so the ~/bin/sensord can be run
RUN echo "export LD_LIBRARY_PATH=/usr/local/lib:\$LD_LIBRARY_PATH" >> ~/.bashrc

RUN updatedb \
    && ln -s /docker /home/stfyc

CMD ["tail", "-f", "/dev/null"]