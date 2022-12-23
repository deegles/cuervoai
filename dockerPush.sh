# bin/sh

npm run docker:login
IFS=":"
sha256_tag=`docker images --no-trunc --quiet discordbot:latest`
read -a strarr <<< "$sha256_tag"

sha256="${strarr[1]}"

app_name="discordbot"
bucket="yourbit-deployment-artifacts"
key="discordBot/version.json"
ecr_repo_id="653625749031"
region="us-east-2"
repo_name="yourbit_ecr"
ecr_repo="$ecr_repo_id.dkr.ecr.$region.amazonaws.com/$repo_name"


repo_tag="$ecr_repo:$app_name$sha256"
app_tag="$ecr_repo:$app_name"
echo "tagged $repo_tag"

docker tag discordbot:latest "$repo_tag"
docker push "$repo_tag"

json="{\"latest\":\"$app_name$sha256\"}"

configPath="/tmp/tagConfig.json"

echo "$json" > $configPath 

echo "updating function tag..."
put_result=$(aws s3api put-object --bucket $bucket --key $key --body $configPath --region us-east-2 --profile discordbot-deployer --acl=bucket-owner-full-control --content-type=application/json)

sleep 3

lambdaConfig=$(aws --region us-east-2 --profile discordbot-deployer lambda get-function --function-name discordbot)
revisionId=$(echo "$lambdaConfig" | jq -r .Configuration.RevisionId)

echo "updating lambda function code for revision $revisionId"
update_result=$(aws --region us-east-2 --profile discordbot-deployer lambda update-function-code --function-name discordbot --revision-id $revisionId --image-uri "$repo_tag") 


images="[{\"imageTag\":\"$app_name\"},\"]"
describe_output=$(aws --region us-east-2 --profile discordbot-deployer ecr describe-images --repository-name yourbit_ecr)
images=$(echo "$describe_output" | jq -r '.[] | map(. | select(.imageTags | any(startswith("discordbot"))))')

num_images=$(echo "$images" | jq -r 'length')

echo "num images $num_images"

if [[ "$num_images" -le 2 ]]; then
  echo "No deletions needed"
else
  images_to_delete=$(echo "$images" | jq '.[0: length - 2]')
  echo "deleting $(echo "$images_to_delete" | jq -r 'length') old images..."
  image_digests="{\"imageDigest\":\"$(echo "$images_to_delete" | jq -r 'map(.imageDigest) | join("\"},{\"imageDigest\":\"")')\"}"
  input_json="{\"imageIds\":[$image_digests]}"
  aws --region us-east-2 --profile discordbot-deployer ecr batch-delete-image --repository-name yourbit_ecr --cli-input-json "$input_json"
fi

#echo "$describe_output" 
#echo "sliced: $images"
echo "Done."