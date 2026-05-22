# 🎓 Bootcamp Platform

Welcome to the **Bootcamp Platform**, a comprehensive Learning Management System (LMS) and Content Management System (CMS) designed specifically for modern bootcamps and educational programs. Built with cutting-edge web technologies, it provides a seamless experience for both administrators/instructors and students.

## ✨ Features

### For Administrators & Instructors (CMS)
- **Course Management:** Create, update, and manage bootcamps, modules, and individual lessons.
- **Rich Content Creation:** Utilize a powerful rich-text editor (powered by Tiptap) for crafting engaging lesson content.
- **Exam Builder:** Create interactive exams and quizzes for students to test their knowledge.
- **Student Management:** Track student progress, manage enrollments, and view performance metrics.

### For Students (Dashboard)
- **Interactive Dashboard:** Access enrolled bootcamps, track progress, and view upcoming classes.
- **Immersive Lesson Player:** A distraction-free learning environment for video lessons, reading materials, and resources.
- **Exam Interface:** A robust and intuitive interface for taking exams and receiving immediate feedback (complete with celebratory confetti upon success!).

## 🛠 Tech Stack

This project is built with modern, high-performance tools:

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend & Database:** [Supabase](https://supabase.com/) (SSR & Auth)
- **Rich Text Editor:** [Tiptap](https://tiptap.dev/)
- **Email Service:** [Resend](https://resend.com/) & Nodemailer
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript

## 🚀 Getting Started

Follow these steps to run the platform locally:

### 1. Clone the repository

```bash
git clone https://github.com/CleveritDemo/bootcamp-platform.git
cd bootcamp-platform
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory and configure your environment variables. You will need credentials for Supabase and your email provider (Resend).

```env
# Example .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application in action.

## 📁 Project Structure

- `/app/cms`: Contains all routes and components for the administrative dashboard (Content Management System).
- `/app/dashboard`: Contains the student-facing learning environment.
- `/components`: Reusable UI components used across both the CMS and Student Dashboard (e.g., `lesson-exam-player.tsx`).
- `/public`: Static assets like images and fonts.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to discuss potential improvements, bug fixes, or new features.

## 📄 License

This project is proprietary and confidential.
