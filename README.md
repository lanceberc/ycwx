# ycwx

Weather web pages for yacht clubs and other interested parties

## Installation

Configuring the prerequisites, particularly `gdal`, is very difficult so a Docker container is included.  Simply run `docker-compose up -d`.

## Scripts

These are run periodically via `crontab`:

* `fetch.sh` - populates `/www/html/data` with fetched images
* `prunedata.sh` - cleans some outdated images from `/www/html/data`
* `cmovie.py` - ?
* `nomads.go` - Not found, obsolete?

## Debugging Python scripts in the Docker container using VSCode

1. Follow the [instructions](https://code.visualstudio.com/docs/python/debugging#_debugging-by-attaching-over-a-network-connection) to install up the VSCode Python extension and the `debugpy` module in Windows
1. In the container, launch the desired script via
    ```bash
    python -m debugpy --listen 0.0.0.0:5678 --wait-for-client /path/to/script.py [args]
    # e.g.
    python -m debugpy --listen 0.0.0.0:5678 --wait-for-client /home/stfyc/bin/paccup_overlay.py -region baydelta
    ```
1. In VSCode, launch the "Python Attach" debug configuration