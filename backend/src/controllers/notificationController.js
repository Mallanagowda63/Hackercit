const prisma = require('../prismaClient');

exports.list = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter((notification) => !notification.read).length;
    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!notification) return res.status(404).json({ error: 'notification not found' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json({ notification: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
