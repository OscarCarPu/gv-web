import json
import os


def get_badge(pct):
    if pct > 40:
        color = "brightgreen"
    elif pct >= 30:
        color = "yellow"
    else:
        color = "red"
    return f"![{pct}%](https://img.shields.io/badge/{pct}%25-{color})"


def main():
    summary_path = "coverage/coverage-summary.json"
    if not os.path.exists(summary_path):
        print(f"Error: {summary_path} not found. Run 'make coverage' first.")
        return

    with open(summary_path) as f:
        data = json.load(f)

    table = [
        "## Coverage\n",
        "| File | Coverage |",
        "| :--- | :---: |",
    ]

    for path in sorted(data.keys()):
        if path == "total":
            continue
        pct = data[path]["lines"]["pct"]
        display_path = path.replace(os.getcwd() + "/", "")
        badge = get_badge(pct)
        table.append(f"| `{display_path}` | {badge} |")

    total_pct = data["total"]["lines"]["pct"]
    total_badge = get_badge(total_pct)
    table.append(f"| **Total** | {total_badge} |")

    table_content = "\n".join(table) + "\n"

    if not os.path.exists("README.md"):
        return

    with open("README.md") as f:
        content = f.read()

    header = "## Coverage"
    start_idx = content.find(header)
    if start_idx == -1:
        return

    rest = content[start_idx + len(header) :]
    next_header_idx = rest.find("\n## ")

    if next_header_idx == -1:
        new_readme = content[:start_idx] + table_content + "\n"
    else:
        new_readme = (
            content[:start_idx] + table_content + "\n" + rest[next_header_idx + 1 :]
        )

    with open("README.md", "w") as f:
        f.write(new_readme)


if __name__ == "__main__":
    main()
