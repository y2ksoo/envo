#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR="/home/pi/envo/data/backups"
DB_PATH="/home/pi/envo/data/envo.db"

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/envo-$DATE.db"

# 7일 이상 된 백업 삭제
find "$BACKUP_DIR" -name "*.db" -mtime +7 -delete

echo "백업 완료: $BACKUP_DIR/envo-$DATE.db"
