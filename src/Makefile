all: airmard sensord

airmard: airmard.c
	cc -g -O -o airmard airmard.c -lwebsockets -lcjson

sensord: sensord.c
	cc -g -O -o sensord sensord.c -lwebsockets -lcjson

clean:
	rm airmard sensord tempestd

install: airmard
	-mv ~/bin/airmard ~/bin/airmard.running
	cp airmard ~/bin
