#!/usr/bin/env bash

# reset staging repo with production
# gsutil -m rm -r gs://realness-staging.appspot.com/people
# gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-staging.appspot.com/

# reset development repo with production
# gsutil -m rm -r gs://realness-development.appspot.com/people
# gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-development.appspot.com/

# # reset in home directory
rm -rf ~/realness.online
mkdir ~/realness.online
gsutil -m cp -R gs://realness-online.appspot.com/people/ ~/realness.online/
# gsutil -m cp -R gs://realness-development.appspot.com/people ~/realness.online/

# reset just me
# gsutil -m rm -r gs://realness-development.appspot.com/people/+16282281824
# gsutil -m cp -R gs://realness-online.appspot.com/people/+16282281824 gs://realness-development.appspot.com/people

# reset just me on staging
# gsutil -m rm -r gs://realness-staging.appspot.com/peoplepeople/+16282281824
# gsutil -m cp -R gs://realness-online.appspot.com/people/+16282281824 gs://realness-staging.appspot.com/people
