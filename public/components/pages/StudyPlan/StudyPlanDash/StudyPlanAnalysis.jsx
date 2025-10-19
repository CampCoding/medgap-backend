import { BarChart3, CheckCircle, Target, TrendingUp } from "lucide-react"; 
import React from "react"; 

export default function StudyPlanAnalysis({progressData}) { 
  console.log(progressData); 
  return ( 
    <div className="bg-white rounded-xl p-8 shadow-lg border-0"> 
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Performance Analytics</h2> 
      <p className="text-gray-600 mb-6">Your study metrics and insights</p> 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"> 
        <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"> 
          <Target className="h-8 w-8 text-blue-500 mr-4" /> 
          <div> 
            <h3 className="font-semibold text-gray-900">94% Accuracy Rate</h3> 
            <p className="text-sm text-gray-600">Questions answered correctly</p> 
          </div> 
        </div> 
        <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"> 
          <CheckCircle className="h-8 w-8 text-green-500 mr-4" /> 
          <div> 
            <h3 className="font-semibold text-gray-900">85% Plan Adherence</h3> 
            <p className="text-sm text-gray-600">Tasks completed on time</p> 
          </div> 
        </div> 
        <div className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100"> 
          <TrendingUp className="h-8 w-8 text-purple-500 mr-4" /> 
          <div> 
            <h3 className="font-semibold text-gray-900">28 Hours This Week</h3> 
            <p className="text-sm text-gray-600">Hours finished this week</p> 
          </div> 
        </div> 
        <div className="flex items-center p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100"> 
          <BarChart3 className="h-8 w-8 text-amber-500 mr-4" /> 
          <div> 
            <h3 className="font-semibold text-gray-900">42 Flashcards Mastered</h3> 
            <p className="text-sm text-gray-600">New cards learned this week</p> 
          </div> 
        </div> 
      </div> 
    </div> 
  ); 
}