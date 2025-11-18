echo -e "Store puppeteer executable in cache\n"

mkdir -p ./.cache

if [ -d "/app/.cache/puppeteer" ]; then
	mv /app/.cache/puppeteer ./.cache
else
	echo "Source directory '/app/.cache/puppeteer' does not exist."
fi