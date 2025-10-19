import { CheckCircle, ArrowRight } from "lucide-react";
import React from "react";

export default function StudyPlanDashTasks({ 
  completedTasksCount, 
  totalTasksCount, 
  showCompletionAnimation, 
  tasks, 
  getTaskTypeIcon, 
  toggleTaskCompletion, 
  getTaskTypeColor, 
}) { 
  return ( 
    <div className="bg-white rounded-xl p-8 shadow-lg border-0"> 
      <div className="flex justify-between items-center mb-6"> 
        <h2 className="text-2xl font-bold text-gray-900">Today's Tasks</h2> 
        <div className="flex items-center space-x-4"> 
          <span className="text-sm font-medium text-gray-600"> 
            {completedTasksCount} of {totalTasksCount} completed 
          </span> 
          <div className="bg-gray-200 rounded-full h-2 w-24"> 
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500" 
              style={{ 
                width: `${(completedTasksCount / Math.max(1, totalTasksCount)) * 100}%`, 
              }} 
            /> 
          </div> 
        </div> 
      </div> 
      <div className="space-y-4"> 
        {tasks.map((task) => { 
          const TaskIcon = getTaskTypeIcon(task.type); 
          return ( 
            <div 
              key={task.id} 
              className={`relative flex items-start p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-md ${ 
                task.completed 
                  ? "bg-green-50 border-green-200 opacity-75" 
                  : "bg-white border-gray-200 hover:border-blue-300" 
              }`} 
              onClick={() => toggleTaskCompletion(task.id)} 
            > 
              {/* Completion Animation */} 
              {showCompletionAnimation === task.id && ( 
                <div className="absolute inset-0 bg-green-100 rounded-xl animate-pulse"></div> 
              )} 
              <div 
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${ 
                  task.completed 
                    ? "bg-green-500 border-green-500" 
                    : "border-gray-300 hover:border-blue-400" 
                }`} 
              > 
                {task.completed && <CheckCircle className="h-4 w-4 text-white" />} 
              </div> 
              <div className="ml-6 flex-1"> 
                <div className="flex items-center mb-2"> 
                  <span 
                    className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${getTaskTypeColor( 
                      task.type 
                    )}`} 
                  > 
                    <TaskIcon className="h-3 w-3 mr-1" /> 
                    {task.type} • {task.duration} 
                  </span> 
                </div> 
                <h3 
                  className={`font-semibold text-lg mb-1 ${ 
                    task.completed ? "line-through text-gray-500" : "text-gray-900" 
                  }`} 
                > 
                  {task.title} 
                </h3> 
                <p className={`text-sm ${task.completed ? "text-gray-400" : "text-gray-600"}`}> 
                  {task.description} 
                </p> 
              </div> 
              <ArrowRight 
                className={`h-5 w-5 transition-all duration-300 ${ 
                  task.completed ? "text-green-500" : "text-gray-400" 
                }`} 
              /> 
            </div> 
          ); 
        })} 
      </div> 
      {completedTasksCount === totalTasksCount && totalTasksCount > 0 && ( 
        <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4"> 
          <div className="flex items-center"> 
            <CheckCircle className="h-8 w-8 text-green-500 mr-3" /> 
            <div> 
              <h3 className="font-semibold text-green-800">Congratulations! 🎉</h3> 
              <p className="text-sm text-green-600"> 
                You've completed all your tasks for today. Great job! 
              </p> 
            </div> 
          </div> 
        </div> 
      )} 
    </div> 
  ); 
}