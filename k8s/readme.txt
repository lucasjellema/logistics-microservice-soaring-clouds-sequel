Steps to deploy in K8S

commit and push all to GitHub : https://github.com/lucasjellema/logistics-microservice-soaring-clouds-sequel

in Vagrant Box

docker run --name logistics-ms -p 3016:3001 -p 4500:4500  -e APPLICATION_ROOT_DIRECTORY=logistics-ms -e APP_PORT=3001 -e ELASTIC_CONNECTOR=http://129.213.11.15/soaring/elastic  -e EVENT_HUB_HOST=129.156.113.171 -e SOARING_SHIPPINGNEWS_TOPIC_NAME=idcs-1d61df536acb4e9d929e79a92f3414b5-soaringshippingnews -e SOARING_PRODUCTS_TOPIC_NAME=idcs-1d61df536acb4e9d929e79a92f3414b5-soaringproducts -e GITHUB_URL=https://github.com/lucasjellema/logistics-microservice-soaring-clouds-sequel -d lucasjellema/node-run-live-reload:0.4.3

- check in logging to see if container is fully initialied
docker logs logistics-ms --follow

- test on laptop
http://192.168.188.142:3016/about

- when container is ready, save the container as a new image
docker commit -m "reloadable logistics ms"  logistics-ms soaring-logistics-ms

- Login to Docker Hub
docker login

- tag image

docker tag soaring-logistics-ms lucasjellema/soaring-logistics-ms:1.0

- push image to Docker Hub
docker push lucasjellema/soaring-logistics-ms:1.0

This creates an image on Docker Hub that contains the dependencies for the Soaring Logistics MS - including Node and the sources from GitHub https://github.com/lucasjellema/logistics-microservice-soaring-clouds-sequel
When this image is run, it will execute the startUpScript.sh and git clone again, npm install again

To run the Soaring Logistics MS locally:

docker run --name soaring-logistics-ms -p 3016:3001 -p 4510:4500  -e GITHUB_URL=https://github.com/lucasjellema/logistics-microservice-soaring-clouds-sequel -e APPLICATION_ROOT_DIRECTORY=logistics-ms -e ELASTIC_CONNECTOR=http://129.213.11.15/soaring/elastic -d lucasjellema/soaring-logistics-ms:1.0

locally on laptop: 192.168.188.142:3016/about 


now on Kubernetes (after changing the yml file to the image lucasjellema/soaring-web-portal:1.0):

(kubectl delete namespaces soaring-clouds)

kubectl delete -f "C:\Users\lucas_j\OneDrive - Conclusion\data\2018-logistics-microservice-soaring-clouds-sequel\k8s\logisticsms-deployment.yml"
kubectl apply -f "C:\Users\lucas_j\OneDrive - Conclusion\data\2018-logistics-microservice-soaring-clouds-sequel\k8s\logisticsms-deployment.yml"
kubectl apply -f "C:\Users\lucas_j\OneDrive - Conclusion\data\2018-logistics-microservice-soaring-clouds-sequel\k8s\logisticsms-service.yml"

and the ingress

kubectl apply -f  "C:\Users\lucas_j\OneDrive - Conclusion\data\2018-logistics-microservice-soaring-clouds-sequel\k8s\logisticsms-ingress.yml"


http://129.213.11.15/soaring/logistics/about

to reload:
http://129.213.11.15/soaring/reloadlogistics/reload

