pm2 start index.js -i 1 --name COOP_API_NODE --cron-restart="0 0 * * *" --watch
pm2 monit
cd "C:\Program Files\Redis"
redis-server "C:\Program Files\Redis\redis.windows.conf"