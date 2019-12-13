##!/usr/bin/env bash
gsutil -m rm -r gs://realness-online.appspot.com/people
gsutil -m cp -R ~/realness.online/people gs://realness-online.appspot.com/
