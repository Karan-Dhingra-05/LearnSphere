import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, value, label, gradient, delay = 0 }) => (
  <motion.div
    className="stat-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    whileHover={{ y: -3, transition: { duration: 0.15 } }}
  >
    <div className="stat-card-icon" style={{ background: gradient }}>
      <Icon size={20} color="white" />
    </div>
    <div className="stat-card-body">
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-label">{label}</p>
    </div>
  </motion.div>
);

export default StatCard;
