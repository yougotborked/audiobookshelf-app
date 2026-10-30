#!/usr/bin/env python3
"""Print recent crashes for com.podshelf.app from the Play Developer Reporting API.

The same data as Play Console -> Quality -> Android vitals -> Crashes & ANRs, read with the
service account the publish workflow already uses, so a crash can be diagnosed from a job log
instead of someone clicking through the Console. Stack traces arrive deobfuscated when the
mapping file was uploaded with the bundle, which the publish workflow does.

Watch builds are told apart by version code: they carry the +1,000,000,000 offset.

    PLAY_SERVICE_ACCOUNT_JSON='{...}' python3 scripts/play-vitals.py
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

PACKAGE = 'com.podshelf.app'
BASE = f'https://playdeveloperreporting.googleapis.com/v1beta1/apps/{PACKAGE}'
WEAR_OFFSET = 1_000_000_000
TRACE_LINES = 60
# Left unset, the search covers roughly the last day, and vitals lag a day or two behind - so
# the first run against a real crash came back empty. Thirty days is as far back as it goes.
WINDOW_DAYS = 30


def token() -> str:
    info = json.loads(os.environ['PLAY_SERVICE_ACCOUNT_JSON'])
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=['https://www.googleapis.com/auth/playdeveloperreporting'])
    creds.refresh(Request())
    print(f'Authenticated as {info.get("client_email")} (project {info.get("project_id")})')
    return creds.token


def get(path: str, auth: str, **params) -> dict:
    r = requests.get(f'{BASE}/{path}', params=params, headers={'Authorization': f'Bearer {auth}'}, timeout=60)
    if r.status_code != 200:
        # The interesting failures are configuration ones - API not enabled in the project, or
        # the account lacking access in Play Console - and Google's message names the fix, so
        # print it whole rather than summarising it.
        print(f'::error::{path} -> HTTP {r.status_code}')
        print(r.text)
        sys.exit(1)
    return r.json()


def window() -> dict:
    params = {}
    now = datetime.now(timezone.utc)
    for edge, at in (('startTime', now - timedelta(days=WINDOW_DAYS)), ('endTime', now)):
        for field in ('year', 'month', 'day', 'hours'):
            params[f'interval.{edge}.{field}'] = getattr(at, 'hour' if field == 'hours' else field)
    return params


def is_watch(version_code) -> bool:
    try:
        return int(version_code) >= WEAR_OFFSET
    except (TypeError, ValueError):
        return False


def main() -> None:
    auth = token()

    # How far the data reaches. An empty result older than this is "no crashes"; anything newer
    # simply has not been processed yet.
    fresh = get('crashRateMetricSet', auth).get('freshnessInfo', {}).get('freshnesses', [])
    for f in fresh:
        print(f"Crash data ({f.get('aggregationPeriod')}) is complete up to {f.get('latestEndTime')}")

    issues = get('errorIssues:search', auth, pageSize=50, **window()).get('errorIssues', [])
    print(f'\n=== {len(issues)} error issue(s) ===')
    for i in issues:
        print(f"- {i.get('type')} | {i.get('cause', '?')} | at {i.get('location', '?')}"
              f" | reports {i.get('errorReportCount')} | users {i.get('distinctUsers')}"
              f" | versions {i.get('firstAppVersion', {}).get('versionCode')}..{i.get('lastAppVersion', {}).get('versionCode')}")

    reports = get('errorReports:search', auth, pageSize=100, **window()).get('errorReports', [])
    watch = [r for r in reports if is_watch(r.get('appVersion', {}).get('versionCode'))]
    print(f'\n=== {len(reports)} recent report(s), {len(watch)} from the watch ===')

    # Watch first, since that is the open question; then everything else, briefly.
    for r in watch[:5] + [r for r in reports if r not in watch][:3]:
        v = r.get('appVersion', {}).get('versionCode')
        print(f"\n--- {'WATCH' if is_watch(v) else 'phone'} | versionCode {v} | {r.get('type')}"
              f" | {r.get('deviceModel', {}).get('marketingName') or r.get('deviceModel', {}).get('deviceId')}"
              f" | Android API {r.get('osVersion', {}).get('apiLevel')} | {r.get('eventTime')}")
        text = (r.get('reportText') or '').splitlines()
        print('\n'.join(text[:TRACE_LINES]))
        if len(text) > TRACE_LINES:
            print(f'... ({len(text) - TRACE_LINES} more lines)')


if __name__ == '__main__':
    main()
