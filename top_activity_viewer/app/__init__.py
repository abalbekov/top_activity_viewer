import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

app = Flask(__name__, static_url_path='/static')

from . import routes
