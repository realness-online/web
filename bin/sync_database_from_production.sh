##!/usr/bin/env bash

# delete staging repo then copy repo from production
gsutil -m rm -r gs://realness-staging.appspot.com/people
gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-staging.appspot.com/

# delete development repo
gsutil -m rm -r gs://realness-development.appspot.com/people
gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-development.appspot.com/

# # delete and copy to the desktop too
gsutil -m cp -R gs://realness-online.appspot.com/people/ ~/realness.online/

# gsutil -m cp -R ~/realness.online/people gs://realness-online.appspot.com/
