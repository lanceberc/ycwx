# ycwx

Weather web pages for yacht clubs and other interested parties

## Installation

1. This repo should be located at `/home/stfyc/`.
2. Install dependencies and compile for your platform. Following instructions have been tested on AlmaLinux 8.
    ```bash
    yum groupinstall -y 'Development Tools' \
        && yum install -y openssl-devel cjson-devel cmake python39 \
        && ln -s /usr/bin/python3.9 /usr/bin/python

    cd /tmp && git clone https://libwebsockets.org/repo/libwebsockets && git checkout 4.3.2 \
        && mkdir build && cd build && cmake .. && make && make install \
        && cd -

    # Install ffmpeg
    dnf install --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-8.noarch.rpm -y \
        && dnf install --nogpgcheck https://mirrors.rpmfusion.org/nonfree/el/rpmfusion-nonfree-release-8.noarch.rpm -y \
        && dnf install ffmpeg -y

    # Compile
    cd /home/stfyc/src && make && make install
    ```
