from manim import *
import random

class BitrateDemonstration(Scene):
    def construct(self):
        # 1. Create a light blue square on a dark background
        square = Square(side_length=2, color="#87CEFA", fill_opacity=1)
        square.move_to(LEFT * 4)

        # Add square to the scene
        self.add(square)

        # Helper function to animate the square going back and forth for exactly 6 seconds
        def animate_square_6_seconds():
            # 4 movements x 1.5 seconds = 6 seconds total
            self.play(square.animate.move_to(RIGHT * 4), run_time=1.5, rate_func=smooth)
            self.play(square.animate.move_to(LEFT * 4), run_time=1.5, rate_func=smooth)
            self.play(square.animate.move_to(RIGHT * 4), run_time=1.5, rate_func=smooth)
            self.play(square.animate.move_to(LEFT * 4), run_time=1.5, rate_func=smooth)

        # --- PART 1: Clean Background (0 to 6 seconds) ---
        # Video codecs handle this perfectly because the background doesn't change.
        animate_square_6_seconds()

        # --- PART 2: Noisy Background (6 to 12 seconds) ---
        # Generate 400 particles to flood the screen with random motion
        particles = VGroup()
        for _ in range(800):
            dot = Dot(radius=random.uniform(0.02, 0.06), color=WHITE, fill_opacity=0.8)
            # Random initial position
            dot.move_to([random.uniform(-7.5, 7.5), random.uniform(-4.5, 4.5), 0])
            # Assign a random velocity vector to each particle
            dot.velocity = np.array([random.uniform(-3, 3), random.uniform(-3, 3), 0])
            particles.add(dot)

        # Updater function to continuously move particles frame-by-frame
        def update_particles(mob, dt):
            for dot in mob:
                dot.shift(dot.velocity * dt)
                # Wrap particles around the screen edges to maintain density
                x, y, z = dot.get_center()
                if x > 7.5: dot.set_x(-7.5)
                elif x < -7.5: dot.set_x(7.5)
                if y > 4.5: dot.set_y(-4.5)
                elif y < -4.5: dot.set_y(4.5)

        particles.add_updater(update_particles)
        self.add(particles)

        # Ensure the square renders on top of the noise
        self.bring_to_front(square)

        # Run the same square animation for another 6 seconds over the noise.
        # When uploaded to YouTube, the random moving particles will starve the 
        # square of bitrate, causing the edges of the square to become blocky and pixelated.
        animate_square_6_seconds()
