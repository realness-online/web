##!/usr/bin/env bash
gsutil -m rm -r gs://realness-development.appspot.com/people
gsutil -m cp -R ~/realness.online/people gs://realness-development.appspot.com/people
