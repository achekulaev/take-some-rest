#!/bin/bash

############ CONFIG ############

OUT_FILENAME='takerest_debug.nw'

#-----#-----#

NW_PATH="/Applications/node-webkit.app/Contents/MacOS/node-webkit"

################################

APP_DIR=`dirname "$0"`

PROCESS_SEARCH=`ps x | grep takerest_debug.nw | grep -v grep | cut -f 1 -d ' '`

if [ "$PROCESS_SEARCH" == "" ]; then
  cd "$APP_DIR"
  rm "$OUT_FILENAME"
  if [ $1 == "-b" ]; then
    zip -r "$OUT_FILENAME" *.html *.js *.css icon.png package.json Sounds node_modules
  else
    clear
    zip -r "$OUT_FILENAME" *.html *.js *.css icon.png package.json Sounds node_modules && "$NW_PATH" "$APP_DIR/$OUT_FILENAME" &
    sleep 2
  fi
else
  echo "$OUT_FILENAME - APPLICATION IS RUNNING. QUIT APPLICATION FIRST"
  echo
  read -p "PRESS ANY KEY"
fi

