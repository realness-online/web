#!/usr/bin/env bash

# delete staging repo then copy repo from production
# gsutil -m rm -r gs://realness-staging.appspot.com/people
# gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-staging.appspot.com/

# delete development repo
# gsutil -m rm -r gs://realness-development.appspot.com/people
# gsutil -m cp -R gs://realness-online.appspot.com/people/ gs://realness-development.appspot.com/

# delete and copy to the desktop too
# rm -rf ~/realness.online
# mkdir ~/realness.online
# gsutil -m cp -R gs://realness-online.appspot.com/people/ ~/realness.online/

# just me
gsutil -m rm -r gs://realness-development.appspot.com/people/+16282281824
gsutil -m cp -R gs://realness-online.appspot.com/people/+16282281824 gs://realness-development.appspot.com/people

# just me on staging
# gsutil -m rm -r gs://realness-staging.appspot.com/peoplepeople/+16282281824
# gsutil -m cp -R gs://realness-online.appspot.com/people/+16282281824 gs://realness-staging.appspot.com/people
