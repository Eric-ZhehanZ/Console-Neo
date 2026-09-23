#!/bin/bash

# This bash script will replace `process.EventEmitter` to 
# `require("events").EventEmitter`in the f**k outdated `root` package.
# Cautious: macOS only.
# Author: JieJiSS

file=`ls ./node_modules/root/`;
for item in $file
  do
    if [ `echo $item | grep tests` ];then 
      file2=`ls ./node_modules/root/tests/`
      for item2 in $file2
        do
          sed -i "" "s/process\.EventEmitter/require('events').EventEmitter/g" node_modules/root/tests/$item2
        done
    else
      sed -i "" "s/process\.EventEmitter/require('events').EventEmitter/g" node_modules/root/$item
    fi
  done
