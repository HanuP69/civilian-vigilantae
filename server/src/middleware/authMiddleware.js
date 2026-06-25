export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token empty' });
  }

  // In a real app, this would verify a JWT or Firebase ID Token.
  // For this hackathon scope, the token IS the userId.
  req.user = { id: token };
  next();
}
