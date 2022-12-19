# bin/sh

npm run docker:login
IFS=":"
sha256_tag=`docker images --no-trunc --quiet discordbot:latest`
read -a strarr <<< "$sha256_tag"

sha256="${strarr[1]}"

bucket="yourbit-deployment-artifacts"
key="discordBot/version.json"

echo "sha is $sha256"
docker tag discordbot:latest "653625749031.dkr.ecr.us-east-2.amazonaws.com/discordbot_ecr:$sha256"
docker push "653625749031.dkr.ecr.us-east-2.amazonaws.com/discordbot_ecr:$sha256"

json="{\"latest\":\"$sha256\"}"

configPath="/tmp/tagConfig.json"

echo "$json" > $configPath 

aws s3api put-object --bucket $bucket --key $key --body $configPath --region us-east-2 --profile discordbot-deployer --acl=bucket-owner-full-control --content-type=application/json