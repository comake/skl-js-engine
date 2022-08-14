#!/usr/bin/env bash
# Script to validate the packaged module

TEST_NAME="Deployment test: packaged module"


echo "$TEST_NAME - Building and installing package"
npm pack --loglevel warn --pack-destination ./test/deploy

cd ./test/deploy

npm install

npm run build

rm comake-skql-js-engine-*.tgz

echo "$TEST_NAME - Running the script"
set -e
trap 'if [[ $? -eq 139 ]]; then echo "Segmentation fault occurred"; exit 1; fi' EXIT

TICKETMASTER_APIKEY=$TICKETMASTER_APIKEY npm run sync

echo "Script Successful"
