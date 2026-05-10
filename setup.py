from setuptools import setup, find_packages

setup(
    name="terminate-code",
    version="0.1.0",
    description="The Self-Evolving AI IDE",
    author="Pytron Labs",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "flask",
        "pytron-client",
        "langchain",
        "black",
        # Add other core dependencies here
    ],
    entry_points={
        "console_scripts": [
            "terminate-code=backend.main:start",
            "tcode=tcode:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
)
