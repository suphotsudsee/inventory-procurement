import React from 'react';

interface StatsCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'red' | 'yellow' | 'green' | 'purple';
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  color = 'blue',
  onClick,
}) => {
  const valueColorClasses = {
    blue: 'text-gray-900',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  };

  return (
    <div
      className={`bg-white overflow-hidden shadow rounded-lg ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="p-5">
        <dl className="space-y-2">
          <dt className="text-sm font-medium text-gray-500">{title}</dt>
          <dd className={`break-all text-2xl font-bold leading-tight ${valueColorClasses[color]}`}>
            {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
          </dd>
          {subtitle && <dt className="text-xs text-gray-400">{subtitle}</dt>}
        </dl>
      </div>
    </div>
  );
};

export default StatsCard;
