#!/usr/bin/env python3
"""Redeploy backend container with fix"""
import paramiko

HOST = "106.53.173.60"
USER = "ubuntu"
PASS = "7kPFGEgOSp0xDO"

def run_command(client, command):
    stdin, stdout, stderr = client.exec_command(command)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return exit_code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30)

    # Pull latest code
    print("[1/5] Pulling latest code...")
    code, out, err = run_command(client, 'cd /home/ubuntu/ishwe && git pull')
    print(f"  Git pull: {out.strip() if out else err.strip()}")

    # Rebuild backend
    print("[2/5] Rebuilding backend container...")
    code, out, err = run_command(client, 'cd /home/ubuntu/ishwe && sudo docker compose build --no-cache backend')
    if code != 0:
        print(f"  ERROR: {err}")
        client.close()
        return
    print("  Backend rebuilt successfully")

    # Restart backend
    print("[3/5] Restarting backend container...")
    code, out, err = run_command(client, 'cd /home/ubuntu/ishwe && sudo docker compose up -d backend')
    if code != 0:
        print(f"  ERROR: {err}")
        client.close()
        return
    print("  Backend restarted successfully")

    # Wait for backend to start
    print("[4/5] Waiting for backend to start...")
    import time
    time.sleep(5)

    # Test API
    print("[5/5] Testing API...")
    code, out, err = run_command(client, 'curl -s http://127.0.0.1:8000/api/health')
    print(f"  Health check: {out}")

    client.close()
    print("\nDone! Backend redeployed successfully.")

if __name__ == "__main__":
    main()
