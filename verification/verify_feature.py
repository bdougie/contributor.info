from playwright.sync_api import Page, expect, sync_playwright

def verify_search_tooltip(page: Page):
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    # 1. Go to homepage
    page.goto("http://localhost:5173/")

    # Wait for network idle or load
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except:
        pass

    # Take a debug screenshot to see what's rendering
    page.screenshot(path="verification/debug_start.png")

    # 2. Find search input
    # The placeholder defaults to "Search repositories (e.g., facebook/react)"
    # Or I can use role combobox
    # Based on the code: aria-label="Search GitHub repositories"
    search_input = page.get_by_role("combobox", name="Search GitHub repositories")

    # Wait for the element to be attached and visible
    # If this fails, we will know from the debug screenshot what's up
    search_input.wait_for(state="visible", timeout=10000)
    expect(search_input).to_be_visible()

    # 3. Type something to make clear button appear
    search_input.fill("react")

    # 4. Find clear button
    clear_button = page.get_by_label("Clear search")
    expect(clear_button).to_be_visible()

    # 5. Hover to trigger tooltip
    clear_button.hover()

    # Tooltips might take a moment or require focus
    # Let's also focus it just in case
    clear_button.focus()

    # 6. Wait for tooltip content
    # The tooltip content is "Clear search"
    tooltip_content = page.get_by_text("Clear search", exact=True)

    # Wait a bit for animation
    page.wait_for_timeout(500)

    # 7. Take screenshot
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_search_tooltip(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()
