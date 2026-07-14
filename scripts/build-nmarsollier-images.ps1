# Construye (una sola vez) las imágenes de los microservicios Go de nmarsollier.
# Estos servicios no se versionan; se buildean desde sus repos remotos y luego
# docker-compose.ecommerce.yml las referencia por tag (image:).
#
# Uso:  ./scripts/build-nmarsollier-images.ps1
$ErrorActionPreference = "Stop"

docker build --no-cache -t fluent            https://raw.githubusercontent.com/nmarsollier/ecommerce/master/fluent/Dockerfile
docker build --no-cache -t prod-auth-go      https://raw.githubusercontent.com/nmarsollier/authgo/master/Dockerfile.prod
docker build --no-cache -t prod-image-go     https://raw.githubusercontent.com/nmarsollier/imagego/master/Dockerfile.prod
docker build --no-cache -t prod-cataloggo-go https://raw.githubusercontent.com/nmarsollier/cataloggo/master/Dockerfile.prod
docker build --no-cache -t prod-cartgo-go    https://raw.githubusercontent.com/nmarsollier/cartgo/master/Dockerfile.prod
docker build --no-cache -t prod-orders-go    https://raw.githubusercontent.com/nmarsollier/ordersgo/master/Dockerfile.prod

Write-Host "Imagenes de nmarsollier construidas. Ahora: docker compose -f docker-compose.ecommerce.yml up -d"
