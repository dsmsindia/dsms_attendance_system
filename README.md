# DSMS Attendance System

A comprehensive, role-based attendance and deployment management system designed for security guard agencies. It provides real-time tracking, dynamic project assignments for reliever personnel, and automated monthly Excel reporting.

## 🌟 Key Features of this Web Application

- **Role-Based Access Control:** Secure dashboards for Admins and Guards.
- **Personnel Management:** Register and manage permanent guards and dynamic reliever personnel.
- **Project/Site Allocation:** Assign guards to specific project sites and track their transfer history.
- **Daily Attendance Logging:** Mark status as Present (P), Absent (A), Double Duty (DD), Half Duty (HD), OFF, or Holiday (H).
- **Dynamic Reliever Support:** Relievers can select different project sites on a daily basis without being bound to a permanent project.
- **Automated Excel Reporting:** Generate dynamic, matrix-style monthly attendance reports formatted in Excel, automatically split by project site.
- **Responsive Design:** Mobile-friendly UI for guards to mark attendance and view their monthly records on the go.

## 🛠️ Tech Stack

**Frontend (Client)**

- React.js (Vite)
- Tailwind CSS & Shadcn UI (Component Library)
- Lucide React (Icons)
- Axios (API Client)

**Backend (Server)**

- Node.js & Express.js
- MongoDB & Mongoose (Database & ODM)
- ExcelJS (Report Generation)
- JSON Web Tokens (JWT Authentication)
