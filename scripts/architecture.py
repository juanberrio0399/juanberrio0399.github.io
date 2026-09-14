from diagrams import Diagram, Cluster
from diagrams.aws.general import User
from diagrams.github.general import Github
from diagrams.onprem.iac import Terraform

with Diagram("Cloud Infrastructure Architecture", show=False, direction="LR", filename="architecture"):
    user = User("User")

    with Cluster("GitHub Pages & Automation"):
        gh_pages = Github("GitHub Pages")
        gh_actions = Github("GitHub Actions")

    with Cluster("Infrastructure Roadmap"):
        terraform = Terraform("Terraform Roadmap")

    user >> gh_pages
    gh_pages >> gh_actions
    gh_actions >> terraform
