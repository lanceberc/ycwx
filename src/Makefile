all: airmard

airmard: airmard.c
	cc -g -O -o airmard airmard.c -lwebsockets -lcjson

clean:
	rm airmard

install: airmard
	-mv ~/bin/airmard ~/bin/airmard.running
	cp airmard ~/bin
