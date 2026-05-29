import time
import re
from django.db import connection


class QueryCountDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Start the timer
        time_start = time.time()

        # Process the request
        response = self.get_response(request)

        # Only analyze API routes to keep your console clean
        if request.path.startswith("/api/"):
            time_end = time.time()
            total_time = time_end - time_start
            queries = connection.queries
            query_count = len(queries)

            # Calculate response size in Kilobytes (KB)
            size_kb = (
                len(response.content) / 1024 if hasattr(response, "content") else 0
            )

            print(f"\n[{request.method} {request.path}]")
            print(
                f"Queries: {query_count} |  Time: {total_time:.3f}s | Size: {size_kb:.1f} KB"
            )

            # If there are queries, let's group them to spot N+1 loops
            if query_count > 0:
                print("Top Query Patterns:")
                query_patterns = {}

                for q in queries:
                    sql = q["sql"]
                    # This regex replaces numbers/IDs with '?' so we can group identical queries
                    # e.g., "SELECT * FROM users WHERE id = 5" becomes "SELECT * FROM users WHERE id = ?"
                    pattern = re.sub(r"\b\d+\b", "?", sql)
                    query_patterns[pattern] = query_patterns.get(pattern, 0) + 1

                # Sort by the most frequently executed queries and show the top 5
                sorted_patterns = sorted(
                    query_patterns.items(), key=lambda x: x[1], reverse=True
                )
                for sql, count in sorted_patterns[:5]:
                    if count > 1:
                        # Highlight anything that runs more than once!
                        print(f"   !!️ Executed {count} times: {sql[:120]}...")
                    else:
                        print(f"   Executed {count} time:  {sql[:120]}...")
            print("-" * 60)

        return response
