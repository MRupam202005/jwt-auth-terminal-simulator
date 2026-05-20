# Interactive JWT Authentication Terminal Simulator

A purely frontend, interactive web application designed to visually simulate the complete JSON Web Token (JWT) authentication lifecycle. Built with HTML, CSS, and Vanilla JavaScript, this tool provides a highly educational, hands-on environment for understanding how JWTs are generated, structured, verified, and refreshed.

## 🚀 Features

- **Interactive Terminal:** An integrated command-line interface to simulate user actions (`login`, `request /api/user`, `refresh-token`, `expire-access`, `logout`).
- **Real-Time Token Decoding:** Instantly breaks down JWTs into their Header, Payload, and Signature components. Automatically decodes the Base64Url parts into readable JSON.
- **Dynamic Timers & Lifecycles:** Visual countdown timers for both the Access Token and Refresh Token, allowing you to watch the expiration states change in real time.
- **Customizable Simulator Config:** 
  - Define custom Usernames and Roles before logging in.
  - Set custom lifespans (in seconds) for Access and Refresh tokens to quickly test edge cases.
- **Refresh Token Rotation (RTR):** A toggleable simulation of RTR, demonstrating how issuing a new refresh token on every renewal enhances security.
- **Editable Secret Key & Tampering:** Modify the server's cryptographic signing key on the fly and watch existing tokens instantly fail validation (`BAD SIG`). Built-in "Tamper" buttons allow you to intentionally corrupt tokens to test system resilience.
- **Silent Auto-Refresh Simulation:** Demonstrates how modern frontends intercept `401 Unauthorized` errors and seamlessly use a Refresh Token to acquire a new Access Token without disrupting the user experience.

## 🛠️ Technology Stack

This project is intentionally built without heavy frameworks or backend dependencies to run completely in the browser:
- **HTML5:** Semantic structure and layout.
- **CSS3:** Modern design using Flexbox, CSS Grid, custom properties (variables), and a premium Dark Cyberpunk/Glassmorphism aesthetic.
- **Vanilla JavaScript:** Handles all logic including:
  - Base64Url encoding/decoding.
  - Deterministic HMAC-SHA256 signature simulation (pure JS algorithm).
  - DOM manipulation and real-time state management.
  - Simulated network delays and asynchronous operations.

## 📂 File Structure

- `index.html`: The core structural layout, containing the terminal, control center, token storage boxes, and educational decoder tabs.
- `style.css`: The styling engine responsible for the sleek, animated, and responsive user interface.
- `app.js`: The brain of the simulator. Contains the command router, cryptographic simulation algorithms, token lifecycle controllers, and UI synchronization loops.

## 🏃‍♂️ How to Run

Since this is a 100% client-side application, running it is incredibly simple:

1. Clone or download the repository.
2. Open `index.html` directly in any modern web browser.
3. No build steps, `npm install`, or backend servers are required!

Alternatively, you can serve it via a local static server:
```bash
npx serve .
# or
python -m http.server 8000
```

## 💻 Terminal Commands

Interact with the terminal on the left panel using the following commands:
- `login [username]` : Authenticate and issue access & refresh tokens.
- `request /api/user`: Make a simulated protected API request using the active access token.
- `refresh-token`    : Force a manual token refresh using the refresh token.
- `expire-access`    : Instantly expire the access token to test auto-refresh mechanisms.
- `expire-refresh`   : Instantly expire both tokens to force a complete re-authentication.
- `logout`           : Clear all tokens and terminate the session.
- `clear`            : Clear the terminal logs screen.
- `help`             : Display the list of available commands.

## 🔒 Educational Note

**Disclaimer:** The cryptographic functions (like the signature generation) inside `app.js` are *simulations* designed purely for visual and educational purposes. They are deterministic approximations of HMAC-SHA256. **Do not use the encryption or token generation logic from this codebase in a real production environment.** Real applications should rely on established, secure backend libraries (e.g., `jsonwebtoken` for Node.js) to issue and verify tokens.
