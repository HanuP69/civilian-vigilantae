import { motion } from 'framer-motion';

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function ChartCard({ title, subtitle, children, height = 280, loading, action }) {
  return (
    <motion.div variants={itemAnim} className="card chart-card">
      <div className="chart-card-header">
        <div className="flex flex-col gap-1">
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <span className="chart-card-subtitle">{subtitle}</span>}
        </div>
        {action}
      </div>
      <div className="chart-card-body" style={{ height }}>
        {loading ? (
          <div className="skeleton" style={{ height: '100%', borderRadius: 'var(--radius-md)' }} />
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

export default ChartCard;
