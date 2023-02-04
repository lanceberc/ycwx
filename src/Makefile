all: airmard sensord

sensord: sensord.c
	cc -g -O -o sensord sensord.c -lwebsockets -lcjson

clean:
	rm airmard sensord tempestd

install: sensord
	-mv ~/bin/sensord ~/bin/sensord.running
	cp sensord ~/bin
