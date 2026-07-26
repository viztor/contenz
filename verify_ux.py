import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Intercept API calls to keep them pending, so we can see the loader
    def delay_route(route):
        pass # Do not fulfill, keeps it loading forever

    page.route("**/api/status", delay_route)
    page.route("**/api/list", delay_route)

    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # Take screenshot of the loader
    page.screenshot(path="/app/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/app/videos")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
