import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t mt-8 py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} Yanghoo AI - 智能内容工作室
            </p>
          </div>
          
          <div className="flex space-x-4">
            <a href="#" className="text-gray-600 hover:text-primary text-sm">关于</a>
            <a href="#" className="text-gray-600 hover:text-primary text-sm">帮助</a>
            <a href="#" className="text-gray-600 hover:text-primary text-sm">隐私</a>
            <a href="#" className="text-gray-600 hover:text-primary text-sm">条款</a>
          </div>
          
          <div className="mt-4 md:mt-0 text-gray-500 text-xs">
            版本 v0.1.2
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 