function ownGuardOrAdmin(req, res, next) {
  const requestedGuardId = req.params.guardId;
  if (req.user.role === "admin") return next();
  if (req.user.guardId && req.user.guardId.toString() === requestedGuardId)
    return next();
  return res
    .status(403)
    .json({ message: "You can only access your own attendance" });
}

module.exports = ownGuardOrAdmin;
