all: sensord

sensord: sensord.c
	cc -g -O -o sensord sensord.c -lwebsockets -lcjson

clean:
	rm sensord

install: sensord
	mkdir -p ~/bin
	touch ~/bin/sensord && mv ~/bin/sensord ~/bin/sensord.running
	cp sensord ~/bin
