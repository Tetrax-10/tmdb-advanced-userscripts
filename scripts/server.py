import asyncio
import websockets
import json

from find_duplicate_images import find_duplicate_images


def get_version():
    """
    Retrieve the current version of the server.
    Returns (str): The version number of the server as a string.
    """
    SERVER_VERSION = "1"
    return SERVER_VERSION


async def handler(websocket):
    """
    Handle incoming messages from the browser/client over the WebSocket connection.
    Sends an initial "connected" message, then listens for JSON messages containing an action.
    """
    # Attempt to notify the client that the server is connected
    try:
        await websocket.send("connected")
        print("✅ Browser connected\n")
    except Exception as e:
        print(f"❌ Failed to send connection acknowledgment: {e}")
        return

    # Listen for incoming messages indefinitely
    try:
        async for message in websocket:
            try:
                # Try to parse the received message as JSON
                json_data = json.loads(message)
                action = json_data.get("action")
                # Extract the 'data' field from the JSON payload
                data = json_data.get("data")
                if data is None:
                    print(f"❌ No data provided for action '{action}'")
                    continue

                # Check if the action is recognized and call the appropriate function
                try:
                    if action == "find_duplicate_images":
                        await find_duplicate_images(data, websocket)
                    else:
                        print("❌ Unknown action received:", action)
                except Exception as e:
                    print(f"❌ Error in {action}: {e}")

            # Handle non-JSON messages
            except json.JSONDecodeError:
                try:
                    # On version_request request, send the server version as version_result message
                    if message == "version_request":
                        await websocket.send(json.dumps({"action": "version_result", "data": get_version()}))
                    else:
                        print("❌ Received unexpected message:", message)
                except Exception as e:
                    print(f"❌ Error for {message}: {e}")
            except Exception as e:
                print("❌ Error while handling message:", message, e)
    except Exception as e:
        # Catch-any other errors in the main receive loop
        print("❌ Unexpected error in handler:", e)


async def main():
    """
    Start the WebSocket server on localhost:8765 and run it indefinitely.
    """
    try:
        async with websockets.serve(handler, "localhost", 8765) as server:
            print("✅ Server running on ws://localhost:8765\n")
            await server.serve_forever()
    except Exception as e:
        print("❌ Failed to start WebSocket server:", e)


if __name__ == "__main__":
    print("⏳ Starting server...")

    # Load imagededup before starting the server
    from imagededup.methods import CNN, PHash

    # Handle gracefuL shutdown on keyboard interrupt or system exit
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
